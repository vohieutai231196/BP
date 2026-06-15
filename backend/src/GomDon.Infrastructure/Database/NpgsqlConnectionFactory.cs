using System.Data;
using Npgsql;

namespace GomDon.Infrastructure.Database;

public sealed class NpgsqlConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public NpgsqlConnectionFactory(string connectionString)
        => _connectionString = connectionString;

    public IDbConnection Create() => new NpgsqlConnection(_connectionString);
}
