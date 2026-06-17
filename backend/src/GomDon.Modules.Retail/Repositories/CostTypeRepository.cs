using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class CostTypeRepository : ICostTypeRepository
{
    private readonly IDbConnectionFactory _factory;
    public CostTypeRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Cols = "id, name, default_amount, unit, active";

    public async Task<List<CostType>> ListAsync(bool activeOnly, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var clause = activeOnly ? "WHERE active = true" : "";
        var items = await conn.QueryAsync<CostType>(new CommandDefinition(
            $"SELECT {Cols} FROM cost_types {clause} ORDER BY id;", cancellationToken: ct));
        return items.ToList();
    }

    public async Task<CostType?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<CostType>(new CommandDefinition(
            $"SELECT {Cols} FROM cost_types WHERE id = @id;", new { id }, cancellationToken: ct));
    }

    public async Task<long> InsertAsync(string name, long? defaultAmount, string unit, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO cost_types(name, default_amount, unit) VALUES(@name, @defaultAmount, @unit) RETURNING id;",
            new { name, defaultAmount, unit }, cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(long id, string name, long? defaultAmount, string unit, bool active, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE cost_types SET name=@name, default_amount=@defaultAmount, unit=@unit, active=@active WHERE id=@id;",
            new { id, name, defaultAmount, unit, active }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM cost_types WHERE id = @id;", new { id }, cancellationToken: ct)) > 0;
    }
}
