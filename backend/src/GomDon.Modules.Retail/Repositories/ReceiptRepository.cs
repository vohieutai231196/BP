using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using GomDon.Shared;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ReceiptRepository : IReceiptRepository
{
    private readonly IDbConnectionFactory _factory;
    public ReceiptRepository(IDbConnectionFactory factory) => _factory = factory;

    /// <summary>
    /// Đường ghi kho DUY NHẤT cho mọi nguồn nhập: tạo phiếu + (tạo SP mới nếu cần)
    /// + movement + product_stock + avg_cost — tất cả trong 1 transaction.
    /// </summary>
    public async Task<ReceiptCreated> CreateAsync(CreateReceiptCommand cmd, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        var receiptId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO receipts(code, source, order_id, supplier_id, note, received_at, created_by)
              VALUES('', @Source, @OrderId, @SupplierId, @Note, COALESCE(@ReceivedAt, now()), @CreatedBy)
              RETURNING id;",
            new { cmd.Source, cmd.OrderId, cmd.SupplierId, cmd.Note, cmd.ReceivedAt, cmd.CreatedBy },
            tx, cancellationToken: ct));

        // Mã phiếu duy nhất, đọc được: PN-yyMMdd-id (giờ VN).
        var code = await conn.ExecuteScalarAsync<string>(new CommandDefinition(
            @"UPDATE receipts
              SET code = 'PN-' || to_char(received_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYMMDD') || '-' || id
              WHERE id = @receiptId RETURNING code;",
            new { receiptId }, tx, cancellationToken: ct));

        int received = 0;
        long totalCost = 0;
        foreach (var line in cmd.Lines)
        {
            if (line.Qty <= 0) continue;
            long productId;

            if (line.ProductId is { } pid)
            {
                var ok = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
                    "SELECT EXISTS(SELECT 1 FROM products WHERE id=@pid AND deleted_at IS NULL);",
                    new { pid }, tx, cancellationToken: ct));
                if (!ok) throw new ValidationException($"Sản phẩm #{pid} không tồn tại.");
                productId = pid;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(line.NewSku))
                    throw new ValidationException("Dòng nhập thiếu SKU cho sản phẩm mới.");
                var exists = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
                    "SELECT EXISTS(SELECT 1 FROM products WHERE lower(sku)=lower(@s) AND deleted_at IS NULL);",
                    new { s = line.NewSku }, tx, cancellationToken: ct));
                if (exists) throw new ValidationException($"SKU '{line.NewSku}' đã tồn tại.");
                productId = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                    @"INSERT INTO products(sku, name, category, image_url, avg_cost)
                      VALUES(@Sku, @Name, @Category, @ImageUrl, 0) RETURNING id;",
                    new
                    {
                        Sku = line.NewSku,
                        Name = string.IsNullOrWhiteSpace(line.NewName) ? line.NewSku : line.NewName,
                        Category = string.IsNullOrWhiteSpace(line.Category) ? "other" : line.Category,
                        line.ImageUrl,
                    }, tx, cancellationToken: ct));
            }

            // khoá dòng tồn rồi tính bình quân gia quyền (chống lost-update khi nhập song song)
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO product_stock(product_id, qty) VALUES(@productId, 0) ON CONFLICT (product_id) DO NOTHING;",
                new { productId }, tx, cancellationToken: ct));
            var cur = await conn.QueryFirstAsync<(long stock, long avg)>(new CommandDefinition(
                @"SELECT ps.qty AS stock, p.avg_cost AS avg
                  FROM product_stock ps JOIN products p ON p.id = ps.product_id
                  WHERE ps.product_id = @productId FOR UPDATE OF ps;",
                new { productId }, tx, cancellationToken: ct));
            long newAvg = StockMath.WeightedAvg(cur.stock, cur.avg, line.Qty, line.UnitCost);

            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO receipt_items(receipt_id, product_id, qty, unit_cost)
                  VALUES(@receiptId, @productId, @Qty, @UnitCost);",
                new { receiptId, productId, line.Qty, line.UnitCost }, tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
                  VALUES(@productId, 'in', @Qty, @UnitCost, 'receipt', @receiptId, @note);",
                new { productId, line.Qty, line.UnitCost, receiptId, note = $"Phiếu nhập {code}" },
                tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE product_stock SET qty = qty + @Qty, updated_at = now() WHERE product_id = @productId;",
                new { productId, line.Qty }, tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE products SET avg_cost = @newAvg WHERE id = @productId;",
                new { newAvg, productId }, tx, cancellationToken: ct));

            if (!string.IsNullOrWhiteSpace(line.LinkCode))
                await conn.ExecuteAsync(new CommandDefinition(
                    @"INSERT INTO product_sources(product_id, order_id, order_link_id, link_code)
                      VALUES(@productId, @OrderId, @OrderLinkId, @LinkCode);",
                    new { productId, cmd.OrderId, line.OrderLinkId, line.LinkCode }, tx, cancellationToken: ct));

            totalCost += (long)line.Qty * line.UnitCost;
            received++;
        }

        if (received == 0) throw new ValidationException("Phiếu nhập không có dòng hợp lệ nào.");

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE receipts SET total_cost = @totalCost WHERE id = @receiptId;",
            new { totalCost, receiptId }, tx, cancellationToken: ct));

        tx.Commit();
        return new ReceiptCreated(receiptId, code!, received);
    }

    public async Task<PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        const string whereSql = @"WHERE (@Source IS NULL OR r.source = @Source)
                AND (@SupplierId IS NULL OR r.supplier_id = @SupplierId)";

        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM receipts r {whereSql};",
            new { q.Source, q.SupplierId }, cancellationToken: ct));

        var rows = await conn.QueryAsync<ReceiptListItem>(new CommandDefinition(
            $@"SELECT r.id, r.code, r.source, r.order_id AS OrderId, r.supplier_id AS SupplierId,
                      s.name AS SupplierName, r.note, r.total_cost AS TotalCost,
                      COALESCE((SELECT COUNT(*) FROM receipt_items ri WHERE ri.receipt_id = r.id),0)::int AS SkuCount,
                      COALESCE((SELECT SUM(ri.qty) FROM receipt_items ri WHERE ri.receipt_id = r.id),0)::bigint AS TotalQty,
                      r.received_at AS ReceivedAt
               FROM receipts r LEFT JOIN suppliers s ON s.id = r.supplier_id
               {whereSql}
               ORDER BY r.received_at DESC, r.id DESC
               LIMIT @pageSize OFFSET @offset;",
            new { q.Source, q.SupplierId, pageSize, offset = (page - 1) * pageSize }, cancellationToken: ct));

        return new PagedResult<ReceiptListItem>
        {
            Items = rows.ToList(), Page = page, PageSize = pageSize, Total = total,
        };
    }

    public async Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var head = await conn.QueryFirstOrDefaultAsync<ReceiptDetail>(new CommandDefinition(
            @"SELECT r.id, r.code, r.source, r.order_id AS OrderId, r.supplier_id AS SupplierId,
                     s.name AS SupplierName, r.note, r.total_cost AS TotalCost, r.received_at AS ReceivedAt
              FROM receipts r LEFT JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = @id;",
            new { id }, cancellationToken: ct));
        if (head is null) return null;

        var items = await conn.QueryAsync<ReceiptItemDetail>(new CommandDefinition(
            @"SELECT ri.product_id AS ProductId, p.sku, p.name, p.image_url AS ImageUrl, ri.qty, ri.unit_cost AS UnitCost
              FROM receipt_items ri JOIN products p ON p.id = ri.product_id
              WHERE ri.receipt_id = @id ORDER BY ri.id;",
            new { id }, cancellationToken: ct));
        head.Items = items.ToList();
        return head;
    }
}
