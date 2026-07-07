using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public sealed class SupplierRepository : ISupplierRepository
{
    private readonly IDbConnectionFactory _factory;
    public SupplierRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<List<Supplier>> ListAsync(bool activeOnly, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var rows = await conn.QueryAsync<Supplier>(new CommandDefinition(
            @"SELECT id, name, phone, note, active, created_at
              FROM suppliers WHERE (@activeOnly = false OR active) ORDER BY name;",
            new { activeOnly }, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<Supplier> CreateAsync(SupplierRequest req, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstAsync<Supplier>(new CommandDefinition(
            @"INSERT INTO suppliers(name, phone, note)
              VALUES(@Name, @Phone, @Note)
              RETURNING id, name, phone, note, active, created_at;",
            new { req.Name, req.Phone, req.Note }, cancellationToken: ct));
    }

    public async Task<bool> UpdateAsync(long id, SupplierRequest req, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var n = await conn.ExecuteAsync(new CommandDefinition(
            @"UPDATE suppliers SET name = @Name, phone = @Phone, note = @Note,
                     active = COALESCE(@Active, active)
              WHERE id = @id;",
            new { id, req.Name, req.Phone, req.Note, req.Active }, cancellationToken: ct));
        return n > 0;
    }

    public async Task<SupplierDeleteOutcome> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var used = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM receipts WHERE supplier_id = @id);", new { id }, cancellationToken: ct));
        if (used)
        {
            var n = await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE suppliers SET active = false WHERE id = @id;", new { id }, cancellationToken: ct));
            return n > 0 ? SupplierDeleteOutcome.Deactivated : SupplierDeleteOutcome.NotFound;
        }
        var del = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM suppliers WHERE id = @id;", new { id }, cancellationToken: ct));
        return del > 0 ? SupplierDeleteOutcome.Deleted : SupplierDeleteOutcome.NotFound;
    }
}
