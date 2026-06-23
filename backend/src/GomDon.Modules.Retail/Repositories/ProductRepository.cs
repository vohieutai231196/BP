using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;
using System.Text.Json;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ProductRepository : IProductRepository
{
    private readonly IDbConnectionFactory _factory;
    public ProductRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Cols = "id, sku, name, category, image_url, status, avg_cost, list_price, created_at";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    private sealed class ProductListRow
    {
        public long Id { get; set; }
        public string Sku { get; set; } = "";
        public string Name { get; set; } = "";
        public string Category { get; set; } = "";
        public string? ImageUrl { get; set; }
        public string Status { get; set; } = "";
        public long AvgCost { get; set; }
        public long? ListPrice { get; set; }
        public DateTime CreatedAt { get; set; }
        public long Stock { get; set; }
        public string? CostTypeSummary { get; set; }
        public string? SourceOrdersJson { get; set; }
    }

    public async Task<List<ProductListItem>> ListAsync(string? status, string? search, long? orderId = null, bool deleted = false, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var where = new List<string> { deleted ? "p.deleted_at IS NOT NULL" : "p.deleted_at IS NULL" };
        if (!string.IsNullOrWhiteSpace(status)) where.Add("p.status = @status");
        if (!string.IsNullOrWhiteSpace(search)) where.Add("(p.name ILIKE @q OR p.sku ILIKE @q)");
        if (orderId is not null)
            where.Add(@"EXISTS (SELECT 1 FROM stock_movements m
                                 WHERE m.product_id = p.id AND m.ref_type = 'import_order' AND m.ref_id = @orderId)");
        var clause = "WHERE " + string.Join(" AND ", where);
        var args = new { status, q = $"%{search}%", orderId };

        var rows = await conn.QueryAsync<ProductListRow>(new CommandDefinition(
            $@"SELECT p.id, p.sku, p.name, p.category, p.image_url AS ImageUrl, p.status, p.avg_cost AS AvgCost,
                      p.list_price AS ListPrice, p.created_at AS CreatedAt,
                      COALESCE((SELECT SUM(qty) FROM stock_movements m WHERE m.product_id = p.id), 0) AS Stock,
                      (SELECT string_agg(ct.name, ', ' ORDER BY ct.name)
                         FROM product_cost_types pct JOIN cost_types ct ON ct.id = pct.cost_type_id
                        WHERE pct.product_id = p.id) AS CostTypeSummary,
                      COALESCE((
                        SELECT json_agg(json_build_object('orderId', s.order_id, 'qty', s.qty) ORDER BY s.last_at DESC)
                        FROM (SELECT m.ref_id AS order_id, SUM(m.qty) AS qty, MAX(m.at) AS last_at
                                FROM stock_movements m
                               WHERE m.product_id = p.id AND m.ref_type = 'import_order' AND m.ref_id IS NOT NULL
                               GROUP BY m.ref_id) s), '[]') AS SourceOrdersJson
               FROM products p {clause} ORDER BY p.created_at DESC;", args, cancellationToken: ct));

        return rows.Select(r => new ProductListItem(
            r.Id, r.Sku, r.Name, r.Category, r.ImageUrl, r.Status, r.AvgCost, r.ListPrice, r.CreatedAt, r.Stock,
            r.CostTypeSummary,
            string.IsNullOrWhiteSpace(r.SourceOrdersJson)
                ? new List<ProductSourceRef>()
                : JsonSerializer.Deserialize<List<ProductSourceRef>>(r.SourceOrdersJson!, JsonOpts) ?? new List<ProductSourceRef>()
        )).ToList();
    }

    public async Task<Product?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<Product>(new CommandDefinition(
            $"SELECT {Cols} FROM products WHERE id = @id AND deleted_at IS NULL;", new { id }, cancellationToken: ct));
    }

    public async Task<(RestoreOutcome Outcome, string? Sku)> RestoreAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var sku = await conn.ExecuteScalarAsync<string?>(new CommandDefinition(
            "SELECT sku FROM products WHERE id = @id;", new { id }, cancellationToken: ct));
        if (sku is null) return (RestoreOutcome.NotFound, null);
        var conflict = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM products WHERE lower(sku) = lower(@sku) AND deleted_at IS NULL AND id <> @id);",
            new { sku, id }, cancellationToken: ct));
        if (conflict) return (RestoreOutcome.SkuConflict, sku);
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE products SET deleted_at = NULL WHERE id = @id;", new { id }, cancellationToken: ct));
        return (RestoreOutcome.Restored, sku);
    }

    public async Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM products WHERE lower(sku) = lower(@sku) AND deleted_at IS NULL);", new { sku }, cancellationToken: ct));
    }

    public async Task<long> InsertAsync(CreateProductRequest req, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO products(sku, name, category, image_url, avg_cost, list_price)
              VALUES(@Sku, @Name, @Category, @ImageUrl, @AvgCost, @ListPrice) RETURNING id;",
            new
            {
                req.Sku, req.Name,
                Category = string.IsNullOrWhiteSpace(req.Category) ? "other" : req.Category,
                req.ImageUrl, req.AvgCost, req.ListPrice,
            }, cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(long id, string name, string category, string? imageUrl, long avgCost, long? listPrice, string status, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            @"UPDATE products SET name=@name, category=@category, image_url=@imageUrl,
                 avg_cost=@avgCost, list_price=@listPrice, status=@status WHERE id=@id;",
            new { id, name, category, imageUrl, avgCost, listPrice, status }, cancellationToken: ct)) > 0;
    }

    // Đang sử dụng: còn đơn bán CHƯA trả (sales.status <> 'returned'), hoặc đang nằm trong combo.
    public async Task<bool> IsInUseAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            @"SELECT EXISTS(SELECT 1 FROM sale_items si
                              JOIN sales s ON s.id = si.sale_id
                             WHERE si.product_id = @id AND s.status <> 'returned')
                  OR EXISTS(SELECT 1 FROM combo_items WHERE product_id = @id);",
            new { id }, cancellationToken: ct));
    }

    // Có lịch sử bán (kể cả đơn đã trả) → còn dòng sale_items tham chiếu, không thể hard delete.
    public async Task<bool> HasSalesHistoryAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM sale_items WHERE product_id = @id);",
            new { id }, cancellationToken: ct));
    }

    // Soft-delete: đánh dấu đã xóa (giữ row cho FK/báo cáo), ẩn khỏi mọi danh sách và giải phóng SKU.
    public async Task SoftDeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE products SET deleted_at = now() WHERE id = @id;", new { id }, cancellationToken: ct));
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM products WHERE id = @id;", new { id }, cancellationToken: ct)) > 0;
    }

    public async Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var row = await conn.QueryFirstOrDefaultAsync<(long stock, long avg_cost)>(new CommandDefinition(
            @"SELECT COALESCE((SELECT SUM(qty) FROM stock_movements m WHERE m.product_id = p.id),0) AS stock, p.avg_cost
              FROM products p WHERE p.id = @productId;", new { productId }, cancellationToken: ct));
        return (row.stock, row.avg_cost);
    }

    public async Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE products SET avg_cost = @avgCost WHERE id = @productId;", new { productId, avgCost }, cancellationToken: ct));
    }

    public async Task<List<ProductCostTypeDto>> GetCostTypesAsync(long productId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<ProductCostTypeDto>(new CommandDefinition(
            @"SELECT pct.cost_type_id AS CostTypeId, ct.name AS Name, ct.unit AS Unit,
                     COALESCE(pct.amount, ct.default_amount, 0) AS Amount
              FROM product_cost_types pct JOIN cost_types ct ON ct.id = pct.cost_type_id
              WHERE pct.product_id = @productId ORDER BY ct.name;",
            new { productId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task SetCostTypesAsync(long productId, IReadOnlyList<ProductCostTypeInput> items, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM product_cost_types WHERE product_id=@productId;", new { productId }, tx, cancellationToken: ct));
        foreach (var it in items.GroupBy(i => i.CostTypeId).Select(g => g.First()))
            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO product_cost_types(product_id, cost_type_id, amount) VALUES(@productId, @CostTypeId, @Amount);",
                new { productId, it.CostTypeId, it.Amount }, tx, cancellationToken: ct));
        tx.Commit();
    }
}
