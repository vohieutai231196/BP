using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using GomDon.Infrastructure.Database;
using GomDon.Shared.Security;
using Microsoft.IdentityModel.Tokens;

namespace GomDon.Api.Auth;

public sealed record LoginResult(string Token, string Name, string Email, string Role, DateTime ExpiresAt);

public sealed class AuthService
{
    private readonly IDbConnectionFactory _factory;
    private readonly IConfiguration _config;

    public AuthService(IDbConnectionFactory factory, IConfiguration config)
    {
        _factory = factory;
        _config = config;
    }

    public async Task<LoginResult?> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        using var conn = _factory.Create();
        var user = await conn.QueryFirstOrDefaultAsync<UserRow>(new CommandDefinition(
            "SELECT email, password_hash, name, role FROM users WHERE email = @email;",
            new { email }, cancellationToken: ct));

        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
            return null;

        return IssueToken(user);
    }

    private LoginResult IssueToken(UserRow user)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(double.Parse(jwt["ExpireHours"] ?? "12"));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"], audience: jwt["Audience"],
            claims: claims, expires: expires, signingCredentials: creds);

        return new LoginResult(
            new JwtSecurityTokenHandler().WriteToken(token),
            user.Name, user.Email, user.Role, expires);
    }

    private sealed class UserRow
    {
        public string Email { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public string Name { get; set; } = "";
        public string Role { get; set; } = "";
    }
}
