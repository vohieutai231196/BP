using GomDon.Api.Auth;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly IUserService _users;
    public AuthController(AuthService auth, IUserService users) { _auth = auth; _users = users; }

    public sealed record LoginRequest(string Email, string Password);

    /// <summary>Đăng nhập dashboard → JWT. Sai mật khẩu → 401; pending/disabled → 403.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var (outcome, result) = await _auth.LoginAsync(req.Email, req.Password, ct);
        return outcome switch
        {
            AuthOutcome.Success => Ok(result),
            AuthOutcome.Pending => StatusCode(StatusCodes.Status403Forbidden, new { message = "Tài khoản đang chờ duyệt." }),
            AuthOutcome.Disabled => StatusCode(StatusCodes.Status403Forbidden, new { message = "Tài khoản đã bị khóa." }),
            _ => Unauthorized(new { message = "Email hoặc mật khẩu không đúng." }),
        };
    }

    /// <summary>Tự đăng ký → tạo tài khoản chờ duyệt.</summary>
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [HttpPost("register")]
    public async Task<ActionResult> Register([FromBody] RegisterRequest req, CancellationToken ct)
    {
        await _users.RegisterAsync(req, ct);
        return Ok(new { message = "Đăng ký thành công. Tài khoản đang chờ admin duyệt." });
    }

    /// <summary>Thông tin người dùng hiện tại.</summary>
    [Authorize]
    [HttpGet("me")]
    public ActionResult Me() => Ok(new
    {
        id = User.FindFirst("uid")?.Value,
        name = User.Identity?.Name,
        email = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value,
        role = User.FindFirst(ClaimTypes.Role)?.Value,
    });
}
