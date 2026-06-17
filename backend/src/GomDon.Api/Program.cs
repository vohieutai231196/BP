using System.Text;
using GomDon.Api.Auth;
using GomDon.Api.Startup;
using GomDon.Infrastructure;
using GomDon.Modules.Orders;
using GomDon.Modules.Users;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;

// ---------- Serilog (Console + Rolling File 30 ngày) ----------
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(
        path: Path.Combine("logs", "gomdon-.log"),
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    var config = builder.Configuration;
    var connectionString = config.GetConnectionString("Postgres")!;

    // Secret bắt buộc — không nhúng trong appsettings.json (xem README/.env.example).
    // Prod/Docker: biến môi trường Jwt__Key. Dev local: `dotnet user-secrets set "Jwt:Key" "..."`.
    var jwtKey = config["Jwt:Key"];
    if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
        throw new InvalidOperationException(
            "Thiếu/không hợp lệ Jwt:Key (cần >= 32 ký tự). " +
            "Đặt env Jwt__Key (prod/docker) hoặc `dotnet user-secrets set \"Jwt:Key\" \"...\"` (dev).");

    // ---------- DI ----------
    builder.Services.AddInfrastructure(connectionString);
    builder.Services.AddOrdersModule();
    builder.Services.AddUsersModule();
    builder.Services.AddHttpClient<GomDon.Modules.Orders.Services.ITranslationService, GomDon.Api.Integrations.GeminiTranslationService>();
    builder.Services.AddHttpClient(); // IHttpClientFactory cho ImageProxyController
    builder.Services.AddScoped<AuthService>();
    builder.Services.AddScoped<DbBootstrapper>();

    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
    builder.Services.AddProblemDetails();

    // Rate-limit cho endpoint ingest (chống extension/độc hại spam)
    builder.Services.AddRateLimiter(o =>
    {
        o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        o.AddFixedWindowLimiter("ingest", opt =>
        {
            opt.PermitLimit = 120;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });
        o.AddFixedWindowLimiter("auth", opt =>
        {
            opt.PermitLimit = 10;
            opt.Window = TimeSpan.FromMinutes(1);
            opt.QueueLimit = 0;
        });
    });

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(o =>
    {
        o.SwaggerDoc("v1", new OpenApiInfo { Title = "GomĐơn API", Version = "v1" });
        o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization", Type = SecuritySchemeType.Http, Scheme = "bearer",
            BearerFormat = "JWT", In = ParameterLocation.Header,
        });
        o.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }, Array.Empty<string>() },
        });
    });

    // ---------- Auth (JWT) ----------
    var jwt = config.GetSection("Jwt");
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opt =>
        {
            opt.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = jwt["Issuer"],
                ValidateAudience = true, ValidAudience = jwt["Audience"],
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
            };
        });
    builder.Services.AddAuthorization();

    // ---------- CORS (FE dashboard + extension) ----------
    var origins = config.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
    builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
        p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

    var app = builder.Build();

    // ---------- Bootstrap DB (schema + seed) ----------
    using (var scope = app.Services.CreateScope())
    {
        var boot = scope.ServiceProvider.GetRequiredService<DbBootstrapper>();
        await boot.RunAsync();
    }

    app.UseExceptionHandler();
    app.UseSerilogRequestLogging();
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors("frontend");
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();

    // health: kiểm tra kết nối DB
    app.MapGet("/health", async (GomDon.Infrastructure.Database.IDbConnectionFactory factory) =>
    {
        try
        {
            using var conn = factory.Create();
            await ((Npgsql.NpgsqlConnection)conn).OpenAsync();
            await Dapper.SqlMapper.ExecuteScalarAsync<int>(conn, "SELECT 1;");
            return Results.Ok(new { status = "ok", db = "up" });
        }
        catch (Exception ex)
        {
            return Results.Json(new { status = "degraded", db = "down", error = ex.Message },
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    });

    Log.Information("GomĐơn API khởi động.");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API dừng bất thường khi khởi động.");
}
finally
{
    Log.CloseAndFlush();
}
