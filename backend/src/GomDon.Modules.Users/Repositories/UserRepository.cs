using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Users.Models;
using GomDon.Shared;

namespace GomDon.Modules.Users.Repositories;

public sealed class UserRepository : IUserRepository
{
    private readonly IDbConnectionFactory _factory;
    public UserRepository(IDbConnectionFactory factory) => _factory = factory;

    private const string Cols = "id, email, password_hash, name, role, status, created_at";

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<User>(new CommandDefinition(
            $"SELECT {Cols} FROM users WHERE lower(email) = lower(@email);", new { email }, cancellationToken: ct));
    }

    public async Task<User?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.QueryFirstOrDefaultAsync<User>(new CommandDefinition(
            $"SELECT {Cols} FROM users WHERE id = @id;", new { id }, cancellationToken: ct));
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT EXISTS(SELECT 1 FROM users WHERE lower(email) = lower(@email));", new { email }, cancellationToken: ct));
    }

    public async Task<long> InsertAsync(string email, string name, string passwordHash, string role, string status, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long>(new CommandDefinition(
            @"INSERT INTO users(email, password_hash, name, role, status)
              VALUES(@email, @passwordHash, @name, @role, @status) RETURNING id;",
            new { email, passwordHash, name, role, status }, cancellationToken: ct));
    }

    public async Task<PagedResult<UserListItem>> ListAsync(string? status, string? search, int page, int pageSize, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var where = new List<string>();
        if (!string.IsNullOrWhiteSpace(status)) where.Add("status = @status");
        if (!string.IsNullOrWhiteSpace(search)) where.Add("(name ILIKE @q OR email ILIKE @q)");
        var clause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var args = new { status, q = $"%{search}%", limit = pageSize, offset = (page - 1) * pageSize };

        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM users {clause};", args, cancellationToken: ct));
        var items = (await conn.QueryAsync<UserListItem>(new CommandDefinition(
            $@"SELECT id, email, name, role, status, created_at
               FROM users {clause}
               ORDER BY (status = 'pending') DESC, created_at DESC
               LIMIT @limit OFFSET @offset;", args, cancellationToken: ct))).ToList();
        return new PagedResult<UserListItem> { Items = items, Page = page, PageSize = pageSize, Total = total };
    }

    public async Task<bool> UpdateNameRoleAsync(long id, string name, string role, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE users SET name = @name, role = @role WHERE id = @id;", new { id, name, role }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> SetStatusAsync(long id, string status, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE users SET status = @status WHERE id = @id;", new { id, status }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> ApproveAsync(long id, string role, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE users SET status = 'active', role = @role WHERE id = @id AND status = 'pending';",
            new { id, role }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> SetPasswordAsync(long id, string passwordHash, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE users SET password_hash = @passwordHash WHERE id = @id;", new { id, passwordHash }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM users WHERE id = @id;", new { id }, cancellationToken: ct)) > 0;
    }

    public async Task<int> CountActiveAdminsAsync(CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM users WHERE role = 'admin' AND status = 'active';", cancellationToken: ct));
    }
}
