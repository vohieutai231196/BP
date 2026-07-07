using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ComboRepository : IComboRepository
{
    private readonly IDbConnectionFactory _factory;
    public ComboRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<List<ComboListItem>> ListAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var combos = (await conn.QueryAsync<Combo>(new CommandDefinition(
            "SELECT id, code, name, image_url, price, active, promotion_id FROM combos ORDER BY id DESC;",
            cancellationToken: ct))).ToList();

        var result = new List<ComboListItem>();
        foreach (var c in combos)
        {
            var comps = await GetComponentsAsync(c.Id, ct);
            long totalCost = comps.Sum(x => (long)x.Qty * x.AvgCost);
            long listTotal = comps.Sum(x => (long)x.Qty * x.ListPrice);
            long available = comps.Count == 0 ? 0
                : comps.Min(x => x.Qty > 0 ? x.Stock / x.Qty : 0);
            result.Add(new ComboListItem(c.Id, c.Code, c.Name, c.ImageUrl, c.Price, c.Active,
                comps.Count, totalCost, listTotal, available));
        }
        return result;
    }

    public async Task<Combo?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<Combo>(new CommandDefinition(
            "SELECT id, code, name, image_url, price, active, promotion_id FROM combos WHERE id=@id;",
            new { id }, cancellationToken: ct));
    }

    public async Task<List<ComboComponent>> GetComponentsAsync(long comboId, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<ComboComponent>(new CommandDefinition(
            @"SELECT ci.product_id AS ProductId, ci.qty AS Qty, ci.line_type AS LineType,
                     COALESCE(p.list_price,0) AS ListPrice, p.avg_cost AS AvgCost,
                     COALESCE((SELECT ps.qty FROM product_stock ps WHERE ps.product_id=p.id),0) AS Stock
              FROM combo_items ci JOIN products p ON p.id = ci.product_id
              WHERE ci.combo_id = @comboId;", new { comboId }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<long> InsertAsync(CreateComboRequest req, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();
        var id = await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            "INSERT INTO combos(code, name, image_url, price) VALUES(@Code,@Name,@ImageUrl,@Price) RETURNING id;",
            new { req.Code, req.Name, req.ImageUrl, req.Price }, tx, cancellationToken: ct));
        foreach (var it in req.Items)
            await conn.ExecuteAsync(new CommandDefinition(
                "INSERT INTO combo_items(combo_id, product_id, qty, line_type) VALUES(@id,@ProductId,@Qty,@lt);",
                new { id, it.ProductId, it.Qty, lt = it.LineType == "tang" ? "tang" : "ban" }, tx, cancellationToken: ct));
        tx.Commit();
        return id;
    }

    public async Task UpdateAsync(long id, string name, string? imageUrl, long price, bool active, IReadOnlyList<CreateComboItemRequest>? items, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        if (conn is System.Data.Common.DbConnection dbc) await dbc.OpenAsync(ct);
        else conn.Open();
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE combos SET name=@name, image_url=@imageUrl, price=@price, active=@active WHERE id=@id;",
            new { id, name, imageUrl, price, active }, tx, cancellationToken: ct));
        if (items is not null)
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM combo_items WHERE combo_id=@id;", new { id }, tx, cancellationToken: ct));
            foreach (var it in items)
                await conn.ExecuteAsync(new CommandDefinition(
                    "INSERT INTO combo_items(combo_id, product_id, qty, line_type) VALUES(@id,@ProductId,@Qty,@lt);",
                    new { id, it.ProductId, it.Qty, lt = it.LineType == "tang" ? "tang" : "ban" }, tx, cancellationToken: ct));
        }
        tx.Commit();
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM combos WHERE id=@id;", new { id }, cancellationToken: ct)) > 0;
    }
}
