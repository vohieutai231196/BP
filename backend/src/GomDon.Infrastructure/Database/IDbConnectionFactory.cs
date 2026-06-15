using System.Data;

namespace GomDon.Infrastructure.Database;

/// <summary>Tạo kết nối DB cho Dapper (PostgreSQL qua Npgsql).</summary>
public interface IDbConnectionFactory
{
    IDbConnection Create();
}
