using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ProductRepository : IProductRepository
{
    private readonly IDbConnectionFactory _factory;
    public ProductRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Cols = "id, sku, name, category, image_url, status, avg_cost, list_price, created_at";

    public async Task<List<ProductListItem>> ListAsync(string? status, string? search, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(status)) where.Add("p.status = @status");
        if (!string.IsNullOrWhiteSpace(search)) where.Add("(p.name ILIKE @q OR p.sku ILIKE @q)");
        var clause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var args = new { status, q = $"%{search}%" };
        var items = await conn.QueryAsync<ProductListItem>(new CommandDefinition(
            $@"SELECT p.id, p.sku, p.name, p.category, p.image_url AS ImageUrl, p.status, p.avg_cost AS AvgCost,
                      p.list_price AS ListPrice, p.created_at AS CreatedAt,
                      COALESCE((SELECT SUM(qty) FROM stock_movements m WHERE m.product_id = p.id), 0) AS Stock
               FROM products p {clause} ORDER BY p.created_at DESC;", args, cancellationToken: ct));
        return items.ToList();
    }

    public async Task<Product?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<Product>(new CommandDefinition(
            $"SELECT {Cols} FROM products WHERE id = @id;", new { id }, cancellationToken: ct));
    }

    public async Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM products WHERE lower(sku) = lower(@sku));", new { sku }, cancellationToken: ct));
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
}
