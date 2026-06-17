using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Modules.Orders.Services;
using GomDon.Shared.Security;
using Npgsql;

namespace GomDon.Api.Startup;

/// <summary>
/// Khởi tạo DB khi API start: chờ Postgres sẵn sàng, chạy schema (idempotent),
/// seed tài khoản admin và (tuỳ chọn) dữ liệu demo.
/// </summary>
public sealed class DbBootstrapper
{
    private readonly IDbConnectionFactory _factory;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly IOrderService _orders;
    private readonly ILogger<DbBootstrapper> _log;

    public DbBootstrapper(IDbConnectionFactory factory, IConfiguration config, IWebHostEnvironment env,
        IOrderService orders, ILogger<DbBootstrapper> log)
    {
        _factory = factory; _config = config; _env = env; _orders = orders; _log = log;
    }

    public async Task RunAsync(CancellationToken ct = default)
    {
        await WaitForDatabaseAsync(ct);
        await RunSchemaAsync(ct);
        await SeedAdminAsync(ct);
        await SeedDemoAsync(ct);
    }

    private async Task WaitForDatabaseAsync(CancellationToken ct)
    {
        for (var attempt = 1; attempt <= 30; attempt++)
        {
            try
            {
                using var conn = _factory.Create();
                await ((NpgsqlConnection)conn).OpenAsync(ct);
                await conn.ExecuteScalarAsync<int>("SELECT 1;");
                _log.LogInformation("Đã kết nối PostgreSQL (lần thử {Attempt}).", attempt);
                return;
            }
            catch (Exception ex) when (attempt < 30)
            {
                _log.LogWarning("Chờ PostgreSQL… (lần {Attempt}): {Msg}", attempt, ex.Message);
                await Task.Delay(2000, ct);
            }
        }
        throw new InvalidOperationException("Không kết nối được PostgreSQL sau nhiều lần thử.");
    }

    private async Task RunSchemaAsync(CancellationToken ct)
    {
        var rel = _config["Database:InitScriptPath"] ?? "db/init.sql";
        var candidates = new[]
        {
            Path.Combine(_env.ContentRootPath, rel),
            Path.Combine(AppContext.BaseDirectory, rel),
            Path.Combine(AppContext.BaseDirectory, Path.GetFileName(rel)),
            "/app/db/init.sql",
            rel,
        };
        var path = candidates.FirstOrDefault(File.Exists);
        if (path is null)
        {
            _log.LogWarning("Không tìm thấy init.sql ({Rel}) — bỏ qua bước tạo schema (giả định DB đã có sẵn).", rel);
            return;
        }

        var sql = await File.ReadAllTextAsync(path, ct);
        using var conn = _factory.Create();
        await conn.ExecuteAsync(sql);
        _log.LogInformation("Đã áp dụng schema từ {Path}.", path);
    }

    private async Task SeedAdminAsync(CancellationToken ct)
    {
        var email = _config["Seed:AdminEmail"] ?? "maianh@gomdon.vn";
        var password = _config["Seed:AdminPassword"] ?? "demo1234";
        var name = _config["Seed:AdminName"] ?? "Quản trị viên";

        using var conn = _factory.Create();
        var exists = await conn.ExecuteScalarAsync<bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE email = @email);", new { email });
        if (exists) return;

        await conn.ExecuteAsync(
            "INSERT INTO users(email, password_hash, name, role, status) VALUES(@e, @h, @n, 'admin', 'active');",
            new { e = email, h = PasswordHasher.Hash(password), n = name });
        _log.LogInformation("Đã seed tài khoản admin: {Email}", email);
    }

    private async Task SeedDemoAsync(CancellationToken ct)
    {
        if (!_config.GetValue("Seed:DemoData", false)) return;

        using var conn = _factory.Create();
        var count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM orders;");
        if (count > 0) return;

        var n = _config.GetValue("Seed:DemoCount", 24);
        var demos = DemoData.Generate(n);
        foreach (var d in demos) await _orders.IngestAsync(d, ct);
        _log.LogInformation("Đã seed {N} đơn demo.", demos.Count);
    }
}
