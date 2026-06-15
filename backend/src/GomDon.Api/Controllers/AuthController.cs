using GomDon.Api.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    public AuthController(AuthService auth) => _auth = auth;

    public sealed record LoginRequest(string Email, string Password);

    /// <summary>Đăng nhập dashboard → trả JWT.</summary>
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest req, CancellationToken ct)
    {
        var result = await _auth.LoginAsync(req.Email, req.Password, ct);
        return result is null
            ? Unauthorized(new { message = "Email hoặc mật khẩu không đúng." })
            : Ok(result);
    }

    /// <summary>Thông tin người dùng hiện tại (kiểm tra token).</summary>
    [Authorize]
    [HttpGet("me")]
    public ActionResult Me() => Ok(new
    {
        name = User.Identity?.Name,
        email = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value,
        role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value,
    });
}
