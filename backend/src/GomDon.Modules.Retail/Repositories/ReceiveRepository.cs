using Dapper;
using GomDon.Infrastructure.Database;

namespace GomDon.Modules.Retail.Repositories;

public sealed class ReceiveRepository : IReceiveRepository
{
    private readonly IDbConnectionFactory _factory;
    public ReceiveRepository(IDbConnectionFactory factory) => _factory = factory;

    public async Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(linkCode)) return null;
        using var conn = _factory.Create();
        return await conn.ExecuteScalarAsync<long?>(new CommandDefinition(
            @"SELECT product_id FROM product_sources WHERE link_code = @linkCode ORDER BY at DESC LIMIT 1;",
            new { linkCode }, cancellationToken: ct));
    }
}
