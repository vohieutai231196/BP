using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;
using GomDon.Shared;

namespace GomDon.Modules.Retail.Repositories;

public sealed class StockRepository : IStockRepository
{
    private readonly IDbConnectionFactory _factory;
    public StockRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<long> GetStockAsync(long productId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COALESCE((SELECT qty FROM product_stock WHERE product_id = @productId), 0);",
            new { productId }, cancellationToken: ct));
    }

    public async Task InsertMovementAsync(long productId, string type, int qty, long unitCost, string? refType, long? refId, string? note, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        await conn.ExecuteAsync(new CommandDefinition(
            @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
              VALUES(@productId, @type, @qty, @unitCost, @refType, @refId, @note);",
            new { productId, type, qty, unitCost, refType, refId, note }, cancellationToken: ct));
    }

    public async Task<PagedResult<StockMovementItem>> ListMovementsAsync(long productId, int page, int pageSize, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM stock_movements WHERE product_id = @productId;",
            new { productId }, cancellationToken: ct));

        var rows = await conn.QueryAsync<StockMovementItem>(new CommandDefinition(
            @"SELECT m.id, m.type, m.qty, m.unit_cost AS UnitCost, m.ref_type AS RefType, m.ref_id AS RefId,
                     COALESCE(r.code, s.code,
                       CASE WHEN m.ref_type = 'import_order' THEN 'Đơn #' || m.ref_id END) AS RefLabel,
                     m.at, m.note
              FROM stock_movements m
              LEFT JOIN receipts r ON m.ref_type = 'receipt' AND r.id = m.ref_id
              LEFT JOIN sales s    ON m.ref_type IN ('sale','return') AND s.id = m.ref_id
              WHERE m.product_id = @productId
              ORDER BY m.at DESC, m.id DESC
              LIMIT @pageSize OFFSET @offset;",
            new { productId, pageSize, offset = (page - 1) * pageSize }, cancellationToken: ct));

        return new PagedResult<StockMovementItem>
        {
            Items = rows.ToList(), Page = page, PageSize = pageSize, Total = total,
        };
    }

    public async Task<StockAdjustResult> AdjustAsync(long productId, long actualQty, string reason, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();

        var exists = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM products WHERE id=@productId AND deleted_at IS NULL);",
            new { productId }, tx, cancellationToken: ct));
        if (!exists)
            throw new System.ComponentModel.DataAnnotations.ValidationException($"Sản phẩm #{productId} không tồn tại.");

        // khoá dòng tồn để delta tính trên số liệu nhất quán
        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO product_stock(product_id, qty) VALUES(@productId, 0) ON CONFLICT (product_id) DO NOTHING;",
            new { productId }, tx, cancellationToken: ct));
        var old = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT qty FROM product_stock WHERE product_id = @productId FOR UPDATE;",
            new { productId }, tx, cancellationToken: ct));

        var delta = actualQty - old;
        if (delta != 0)
        {
            var avg = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
                "SELECT avg_cost FROM products WHERE id = @productId;", new { productId }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition(
                @"INSERT INTO stock_movements(product_id, type, qty, unit_cost, ref_type, ref_id, note)
                  VALUES(@productId, 'adjust', @delta, @avg, 'manual', NULL, @reason);",
                new { productId, delta = (int)delta, avg, reason }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE product_stock SET qty = @actualQty, updated_at = now() WHERE product_id = @productId;",
                new { productId, actualQty }, tx, cancellationToken: ct));
        }

        tx.Commit();
        return new StockAdjustResult(productId, old, actualQty, delta);
    }
}
