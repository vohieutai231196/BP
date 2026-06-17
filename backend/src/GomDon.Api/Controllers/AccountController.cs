using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/account")]
[Authorize]
public sealed class AccountController : ControllerBase
{
    private readonly IUserService _users;
    public AccountController(IUserService users) => _users = users;

    private long Uid() => long.Parse(User.FindFirst("uid")!.Value);

    [HttpPatch("password")]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest req, CancellationToken ct)
    { await _users.ChangeOwnPasswordAsync(Uid(), req.CurrentPassword, req.NewPassword, ct); return NoContent(); }

    [HttpPatch("profile")]
    public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileRequest req, CancellationToken ct)
    { await _users.UpdateOwnProfileAsync(Uid(), req.Name, ct); return NoContent(); }
}
