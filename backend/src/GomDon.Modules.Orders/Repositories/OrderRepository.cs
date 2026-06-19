using System.Data;
using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Orders.Models;
using GomDon.Shared;

namespace GomDon.Modules.Orders.Repositories;

public sealed class OrderRepository : IOrderRepository
{
    private readonly IDbConnectionFactory _factory;

    public OrderRepository(IDbConnectionFactory factory) => _factory = factory;

    // ---------- LIST ----------
    public async Task<PagedResult<OrderSummary>> ListAsync(OrderQuery q, CancellationToken ct = default)
    {
        var where = new List<string>();
        var p = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(q.Status) && q.Status != "all")
        {
            where.Add("o.status = @status");
            p.Add("status", q.Status);
        }
        if (q.PayOnly) where.Add("c.con_thieu > 0");
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            where.Add("(CAST(o.id AS TEXT) LIKE @q OR o.product_name ILIKE @q OR cu.name ILIKE @q OR pl.label ILIKE @q)");
            p.Add("q", $"%{q.Search.Trim()}%");
        }

        var orderBy = q.Sort switch
        {
            "value"  => "c.tong_chi_phi DESC",
            "weight" => "o.weight_real DESC",
            "due"    => "c.con_thieu DESC",
            _        => "o.created_at DESC",
        };

        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);
        // export: ?all=true lấy hết (bỏ phân trang)
        var limitSql = q.All ? "LIMIT ALL OFFSET 0" : "LIMIT @limit OFFSET @offset";
        if (!q.All)
        {
            p.Add("limit", size);
            p.Add("offset", (page - 1) * size);
        }

        var whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var sql = $@"
SELECT o.id, o.status,
       o.platform_key, pl.label AS platform_label, pl.tint AS platform_tint,
       o.product_name, o.category,
       cu.name AS customer_name, cu.phone AS customer_phone,
       o.vip, o.weight_real,
       c.tong_chi_phi, c.da_thanh_toan, c.con_thieu,
       o.created_at,
       (SELECT COUNT(*) FROM order_packages pk WHERE pk.order_id = o.id) AS packages_count,
       COUNT(*) OVER() AS total_count
FROM orders o
JOIN platforms pl ON pl.key = o.platform_key
JOIN customers cu ON cu.id = o.customer_id
JOIN order_costs c ON c.order_id = o.id
{whereSql}
ORDER BY {orderBy}
{limitSql};";

        using var conn = _factory.Create();
        var rows = (await conn.QueryAsync<OrderSummaryRow>(new CommandDefinition(sql, p, cancellationToken: ct))).ToList();
        var total = rows.Count > 0 ? rows[0].TotalCount : 0;

        return new PagedResult<OrderSummary>
        {
            Items = rows.Select(r => r.ToSummary()).ToList(),
            Page = page,
            PageSize = size,
            Total = total,
        };
    }

    // ---------- DETAIL ----------
    public async Task<OrderDetail?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        const string sql = @"
SELECT o.id, o.status, o.product_name, o.category, o.vip, o.shipping_type, o.warehouse,
       o.buy_fee_pct, o.exchange_rate, o.weight_real, o.weight_charged, o.promo, o.created_at,
       o.platform_key, pl.label AS platform_label, pl.tint AS platform_tint,
       cu.name AS customer_name, cu.phone AS customer_phone,
       c.tien_hang, c.phi_tra_them, c.ship_tq, c.phi_mua_hang, c.phi_kiem_dem,
       c.tong_tien_hang, c.tien_can_nang, c.dong_go, c.cuoc_phat_sinh, c.luu_kho,
       c.tong_chi_phi, c.da_thanh_toan, c.con_thieu,
       t.dat_coc, t.da_mua, t.ve_vn, t.kho_vn, t.tra_hang
FROM orders o
JOIN platforms pl ON pl.key = o.platform_key
JOIN customers cu ON cu.id = o.customer_id
JOIN order_costs c ON c.order_id = o.id
LEFT JOIN order_timeline t ON t.order_id = o.id
WHERE o.id = @id;

SELECT code, weight, weight_charged, unit_price, total, extra, seller_ship, to_vn, in_vn
FROM order_packages WHERE order_id = @id ORDER BY id;

SELECT at, text FROM order_history WHERE order_id = @id ORDER BY at;

SELECT at, reason, amount FROM order_payments WHERE order_id = @id ORDER BY at;

SELECT idx, link_code, spec, spec_vi, name, source_url, image_url, qty, price_vnd, price_cny, note FROM order_links WHERE order_id = @id ORDER BY idx;";

        using var conn = _factory.Create();
        using var multi = await conn.QueryMultipleAsync(new CommandDefinition(sql, new { id }, cancellationToken: ct));

        var head = await multi.ReadFirstOrDefaultAsync<OrderDetailRow>();
        if (head is null) return null;

        var packages = (await multi.ReadAsync<PackageDto>()).ToList();
        var history = (await multi.ReadAsync<HistoryDto>()).ToList();
        var payments = (await multi.ReadAsync<PaymentDto>()).ToList();
        var links = (await multi.ReadAsync<LinkDto>()).ToList();

        return head.ToDetail(packages, history, payments, links);
    }

    // ---------- INGEST ----------
    public async Task<long> IngestAsync(IngestOrderRequest r, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        // upsert customer
        var customerId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO customers(name, phone) VALUES(@CustomerName, @CustomerPhone) RETURNING id;",
            r, tx, cancellationToken: ct));

        var id = r.Id ?? await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COALESCE(MAX(id), 647999) + 1 FROM orders;", transaction: tx, cancellationToken: ct));

        // Thu thập lại đơn đã có (id cố định từ sàn) → ghi đè: xoá bản cũ trước.
        if (r.Id.HasValue)
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM orders WHERE id = @id;", new { id }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO orders(id, status, platform_key, customer_id, product_name, category, vip,
                   shipping_type, warehouse, buy_fee_pct, exchange_rate, weight_real, weight_charged, promo, created_at)
VALUES(@id, @Status, @PlatformKey, @customerId, @ProductName, @Category, @Vip,
       @Shipping, @Warehouse, @BuyFeePct, @Rate, @WeightReal, @WeightCharged, @Promo, COALESCE(@CreatedAt, now()));",
            new
            {
                id, customerId, r.Status, r.PlatformKey, r.ProductName, r.Category, r.Vip,
                r.Shipping, r.Warehouse, r.BuyFeePct, r.Rate, r.WeightReal, r.WeightCharged, r.Promo, r.CreatedAt,
            }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO order_costs(order_id, tien_hang, phi_tra_them, ship_tq, phi_mua_hang, phi_kiem_dem,
                        tien_can_nang, dong_go, cuoc_phat_sinh, luu_kho, da_thanh_toan)
VALUES(@id, @TienHang, @PhiTraThem, @ShipTQ, @PhiMuaHang, @PhiKiemDem,
       @TienCanNang, @DongGo, @CuocPhatSinh, @LuuKho, @DaThanhToan);",
            new
            {
                id, r.Costs.TienHang, r.Costs.PhiTraThem, r.Costs.ShipTQ, r.Costs.PhiMuaHang, r.Costs.PhiKiemDem,
                r.Costs.TienCanNang, r.Costs.DongGo, r.Costs.CuocPhatSinh, r.Costs.LuuKho, r.Costs.DaThanhToan,
            }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO order_timeline(order_id, dat_coc, da_mua, ve_vn, kho_vn, tra_hang)
VALUES(@id, @DatCoc, @DaMua, @VeVN, @KhoVN, @TraHang);",
            new { id, r.Timeline.DatCoc, r.Timeline.DaMua, r.Timeline.VeVN, r.Timeline.KhoVN, r.Timeline.TraHang },
            tx, cancellationToken: ct));

        foreach (var pk in r.Packages)
            await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO order_packages(order_id, code, weight, weight_charged, unit_price, total, extra, seller_ship, to_vn, in_vn)
VALUES(@id, @Code, @Weight, @WeightCharged, @UnitPrice, @Total, @Extra, @SellerShip, @ToVN, @InVN);",
                new { id, pk.Code, pk.Weight, pk.WeightCharged, pk.UnitPrice, pk.Total, pk.Extra, pk.SellerShip, pk.ToVN, pk.InVN },
                tx, cancellationToken: ct));

        foreach (var h in r.History)
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO order_history(order_id, at, text) VALUES(@id, @At, @Text);",
                new { id, h.At, h.Text }, tx, cancellationToken: ct));

        foreach (var pay in r.Payments)
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO order_payments(order_id, at, reason, amount) VALUES(@id, @At, @Reason, @Amount);",
                new { id, pay.At, pay.Reason, pay.Amount }, tx, cancellationToken: ct));

        foreach (var lk in r.Links)
            await conn.ExecuteAsync(new CommandDefinition(@"
INSERT INTO order_links(order_id, idx, link_code, spec, spec_vi, name, source_url, image_url, qty, price_vnd, price_cny, note)
VALUES(@id, @Idx, @LinkCode, @Spec, @SpecVi, @Name, @SourceUrl, @ImageUrl, @Qty, @PriceVnd, @PriceCny, @Note);",
                new { id, lk.Idx, lk.LinkCode, lk.Spec, lk.SpecVi, lk.Name, lk.SourceUrl, lk.ImageUrl, lk.Qty, lk.PriceVnd, lk.PriceCny, lk.Note }, tx, cancellationToken: ct));

        tx.Commit();
        return id;
    }

    // ---------- DASHBOARD ----------
    public async Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default)
    {
        const string sql = @"
SELECT COUNT(*)                                  AS total_orders,
       COALESCE(SUM(c.tong_chi_phi), 0)          AS total_revenue,
       COALESCE(SUM(c.da_thanh_toan), 0)         AS total_collected,
       COALESCE(SUM(c.con_thieu), 0)             AS total_outstanding,
       COALESCE(SUM(o.weight_real), 0)           AS total_weight,
       COUNT(*) FILTER (WHERE c.con_thieu > 0)   AS outstanding_orders
FROM orders o JOIN order_costs c ON c.order_id = o.id;

SELECT status, COUNT(*) AS count FROM orders GROUP BY status;

SELECT d::date AS day, COUNT(o.id) AS count
FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') d
LEFT JOIN orders o ON o.created_at::date = d::date
GROUP BY d ORDER BY d;

SELECT pl.key, pl.label, pl.tint, COUNT(o.id) AS count
FROM platforms pl LEFT JOIN orders o ON o.platform_key = pl.key
GROUP BY pl.key, pl.label, pl.tint ORDER BY count DESC;

SELECT warehouse AS name, COUNT(*) AS count FROM orders GROUP BY warehouse ORDER BY count DESC;";

        using var conn = _factory.Create();
        using var multi = await conn.QueryMultipleAsync(new CommandDefinition(sql, cancellationToken: ct));

        var totals = await multi.ReadFirstAsync<DashboardSummary>();
        var statusRows = (await multi.ReadAsync<(string status, int count)>()).ToList();
        var series = (await multi.ReadAsync<SeriesPoint>()).ToList();
        var platformAgg = (await multi.ReadAsync<PlatformAgg>()).ToList();
        var warehouseAgg = (await multi.ReadAsync<WarehouseAgg>()).ToList();

        totals.StatusCounts = statusRows.ToDictionary(x => x.status, x => x.count);
        foreach (var s in series) s.Label = s.Day.ToString("dd/MM");
        totals.Series = series;
        totals.PlatformAgg = platformAgg;
        totals.WarehouseAgg = warehouseAgg;
        return totals;
    }

    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition("SELECT COUNT(*) FROM orders;", cancellationToken: ct));
    }

    // ---------- DELETE (cascade sang packages/costs/timeline/history/payments/links) ----------
    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM orders WHERE id = @id;", new { id }, cancellationToken: ct));
        return affected > 0;
    }

    // ---------- UPDATE STATUS ----------
    public async Task<bool> UpdateStatusAsync(long id, string status, string historyText, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE orders SET status = @status WHERE id = @id;",
            new { id, status }, tx, cancellationToken: ct));

        if (affected == 0) { tx.Rollback(); return false; }

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO order_history(order_id, at, text) VALUES(@id, now(), @historyText);",
            new { id, historyText }, tx, cancellationToken: ct));

        tx.Commit();
        return true;
    }

    // ---------- flat rows ----------
    private sealed class OrderSummaryRow
    {
        public long Id { get; set; }
        public string Status { get; set; } = "";
        public string PlatformKey { get; set; } = "";
        public string PlatformLabel { get; set; } = "";
        public string PlatformTint { get; set; } = "";
        public string ProductName { get; set; } = "";
        public string Category { get; set; } = "";
        public string CustomerName { get; set; } = "";
        public string CustomerPhone { get; set; } = "";
        public string Vip { get; set; } = "";
        public int PackagesCount { get; set; }
        public decimal WeightReal { get; set; }
        public long TongChiPhi { get; set; }
        public long DaThanhToan { get; set; }
        public long ConThieu { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public int TotalCount { get; set; }

        public OrderSummary ToSummary() => new()
        {
            Id = Id, Status = Status, PlatformKey = PlatformKey, PlatformLabel = PlatformLabel, PlatformTint = PlatformTint,
            ProductName = ProductName, Category = Category, CustomerName = CustomerName, CustomerPhone = CustomerPhone,
            Vip = Vip, PackagesCount = PackagesCount, WeightReal = WeightReal,
            TongChiPhi = TongChiPhi, DaThanhToan = DaThanhToan, ConThieu = ConThieu, CreatedAt = CreatedAt,
        };
    }

    private sealed class OrderDetailRow
    {
        public long Id { get; set; }
        public string Status { get; set; } = "";
        public string ProductName { get; set; } = "";
        public string Category { get; set; } = "";
        public string Vip { get; set; } = "";
        public string ShippingType { get; set; } = "";
        public string Warehouse { get; set; } = "";
        public int BuyFeePct { get; set; }
        public int ExchangeRate { get; set; }
        public decimal WeightReal { get; set; }
        public decimal WeightCharged { get; set; }
        public string? Promo { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public string PlatformKey { get; set; } = "";
        public string PlatformLabel { get; set; } = "";
        public string PlatformTint { get; set; } = "";
        public string CustomerName { get; set; } = "";
        public string CustomerPhone { get; set; } = "";
        public long TienHang { get; set; }
        public long PhiTraThem { get; set; }
        public long ShipTQ { get; set; }
        public long PhiMuaHang { get; set; }
        public long PhiKiemDem { get; set; }
        public long TongTienHang { get; set; }
        public long TienCanNang { get; set; }
        public long DongGo { get; set; }
        public long CuocPhatSinh { get; set; }
        public long LuuKho { get; set; }
        public long TongChiPhi { get; set; }
        public long DaThanhToan { get; set; }
        public long ConThieu { get; set; }
        public DateTimeOffset? DatCoc { get; set; }
        public DateTimeOffset? DaMua { get; set; }
        public DateTimeOffset? VeVN { get; set; }
        public DateTimeOffset? KhoVN { get; set; }
        public DateTimeOffset? TraHang { get; set; }

        public OrderDetail ToDetail(List<PackageDto> packages, List<HistoryDto> history, List<PaymentDto> payments, List<LinkDto> links) => new()
        {
            Id = Id, Status = Status, ProductName = ProductName, Category = Category, Vip = Vip,
            Shipping = ShippingType, Warehouse = Warehouse, BuyFeePct = BuyFeePct, Rate = ExchangeRate,
            WeightReal = WeightReal, WeightCharged = WeightCharged, Promo = Promo, CreatedAt = CreatedAt,
            PackagesCount = packages.Count,
            Platform = new PlatformDto { Key = PlatformKey, Label = PlatformLabel, Tint = PlatformTint },
            Customer = new CustomerDto { Name = CustomerName, Phone = CustomerPhone },
            Costs = new CostsDto
            {
                TienHang = TienHang, PhiTraThem = PhiTraThem, ShipTQ = ShipTQ, PhiMuaHang = PhiMuaHang, PhiKiemDem = PhiKiemDem,
                TongTienHang = TongTienHang, TienCanNang = TienCanNang, DongGo = DongGo, CuocPhatSinh = CuocPhatSinh, LuuKho = LuuKho,
                TongChiPhi = TongChiPhi, DaThanhToan = DaThanhToan, ConThieu = ConThieu,
            },
            Timeline = new TimelineDto { DatCoc = DatCoc, DaMua = DaMua, VeVN = VeVN, KhoVN = KhoVN, TraHang = TraHang },
            Packages = packages, History = history, Payments = payments, Links = links,
        };
    }
}
