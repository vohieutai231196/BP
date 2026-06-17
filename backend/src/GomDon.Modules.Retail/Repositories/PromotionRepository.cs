using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class PromotionRepository : IPromotionRepository
{
    private readonly IDbConnectionFactory _factory;
    public PromotionRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<List<PromotionListItem>> ListAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var items = await conn.QueryAsync<PromotionListItem>(new CommandDefinition(
            @"SELECT p.id, p.name, p.type, p.value, p.start_at, p.end_at, p.active,
                     COALESCE((SELECT COUNT(*) FROM promotion_products pp WHERE pp.promotion_id=p.id),0) AS product_count
              FROM promotions p ORDER BY p.id DESC;", cancellationToken: ct));
        return items.ToList();
    }

    public async Task<Promotion?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<Promotion>(new CommandDefinition(
            "SELECT id, name, type, value, start_at, end_at, active FROM promotions WHERE id=@id;",
            new { id }, cancellationToken: ct));
    }

    public async Task<List<long>> GetProductIdsAsync(long promotionId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var ids = await conn.QueryAsync<long>(new CommandDefinition(
            "SELECT product_id FROM promotion_products WHERE promotion_id=@promotionId;",
            new { promotionId }, cancellationToken: ct));
        return ids.ToList();
    }

    public async Task<long> InsertAsync(string name, string type, long value, DateTime? startAt, DateTime? endAt, IReadOnlyList<long> productIds, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();
        var id = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO promotions(name, type, value, start_at, end_at) VALUES(@name, @type, @value, @startAt, @endAt) RETURNING id;",
            new { name, type, value, startAt, endAt }, tx, cancellationToken: ct));
        foreach (var pid in productIds.Distinct())
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO promotion_products(promotion_id, product_id) VALUES(@id, @pid) ON CONFLICT DO NOTHING;",
                new { id, pid }, tx, cancellationToken: ct));
        tx.Commit();
        return id;
    }

    public async Task UpdateAsync(long id, string name, string type, long value, DateTime? startAt, DateTime? endAt, bool active, IReadOnlyList<long> productIds, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync(new CommandDefinition(
            @"UPDATE promotions SET name=@name, type=@type, value=@value, start_at=@startAt, end_at=@endAt, active=@active WHERE id=@id;",
            new { id, name, type, value, startAt, endAt, active }, tx, cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM promotion_products WHERE promotion_id=@id;", new { id }, tx, cancellationToken: ct));
        foreach (var pid in productIds.Distinct())
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO promotion_products(promotion_id, product_id) VALUES(@id, @pid) ON CONFLICT DO NOTHING;",
                new { id, pid }, tx, cancellationToken: ct));
        tx.Commit();
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM promotions WHERE id=@id;", new { id }, cancellationToken: ct)) > 0;
    }

    public async Task<List<(long, long, long, string, string, long)>> GetActiveRawAsync(DateTime now, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<(long product_id, long list_price, long promotion_id, string name, string type, long value)>(
            new CommandDefinition(
            @"SELECT pp.product_id, COALESCE(pr.list_price,0) AS list_price, p.id AS promotion_id, p.name, p.type, p.value
              FROM promotions p
              JOIN promotion_products pp ON pp.promotion_id = p.id
              JOIN products pr ON pr.id = pp.product_id
              WHERE p.active = true
                AND (p.start_at IS NULL OR p.start_at <= @now)
                AND (p.end_at   IS NULL OR p.end_at   >= @now);",
            new { now }, cancellationToken: ct));
        return rows.Select(r => (r.product_id, r.list_price, r.promotion_id, r.name, r.type, r.value)).ToList();
    }
}
