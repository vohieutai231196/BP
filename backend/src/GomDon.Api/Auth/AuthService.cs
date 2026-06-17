using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Services;
using Microsoft.IdentityModel.Tokens;

namespace GomDon.Api.Auth;

public sealed record LoginResult(string Token, long Id, string Name, string Email, string Role, DateTime ExpiresAt);

public sealed class AuthService
{
    private readonly IUserService _users;
    private readonly IConfiguration _config;

    public AuthService(IUserService users, IConfiguration config)
    {
        _users = users;
        _config = config;
    }

    /// <summary>Xác thực + phát JWT. Trả outcome để controller map mã HTTP (401 sai mật khẩu, 403 pending/disabled).</summary>
    public async Task<(AuthOutcome Outcome, LoginResult? Result)> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        var auth = await _users.AuthenticateAsync(email, password, ct);
        if (auth.Outcome != AuthOutcome.Success || auth.User is null)
            return (auth.Outcome, null);
        return (AuthOutcome.Success, IssueToken(auth.User));
    }

    private LoginResult IssueToken(User user)
    {
        var jwt = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(double.Parse(jwt["ExpireHours"] ?? "12"));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim("uid", user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role),
        };

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"], audience: jwt["Audience"],
            claims: claims, expires: expires, signingCredentials: creds);

        return new LoginResult(
            new JwtSecurityTokenHandler().WriteToken(token),
            user.Id, user.Name, user.Email, user.Role, expires);
    }
}
