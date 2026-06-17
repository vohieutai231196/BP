using Dapper;
using GomDon.Infrastructure.Database;

namespace GomDon.Modules.Retail.Repositories;

public sealed class StockRepository : IStockRepository
{
    private readonly IDbConnectionFactory _factory;
    public StockRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<long> GetStockAsync(long productId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "SELECT COALESCE(SUM(qty),0) FROM stock_movements WHERE product_id = @productId;",
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
}
