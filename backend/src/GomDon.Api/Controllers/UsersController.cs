using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/users")]
[Authorize(Roles = "admin")]
public sealed class UsersController : ControllerBase
{
    private readonly IUserService _users;
    public UsersController(IUserService users) => _users = users;

    private long Uid() => long.Parse(User.FindFirst("uid")!.Value);

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? status, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _users.ListAsync(status, search, page, pageSize, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateUserRequest req, CancellationToken ct)
        => Ok(await _users.CreateAsync(req, ct));

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdateUserRequest req, CancellationToken ct)
    { await _users.UpdateAsync(id, req, Uid(), ct); return NoContent(); }

    [HttpPost("{id:long}/approve")]
    public async Task<ActionResult> Approve(long id, [FromBody] ApproveRequest req, CancellationToken ct)
    { await _users.ApproveAsync(id, req.Role, ct); return NoContent(); }

    [HttpPost("{id:long}/reject")]
    public async Task<ActionResult> Reject(long id, CancellationToken ct)
    { await _users.RejectAsync(id, ct); return NoContent(); }

    [HttpPost("{id:long}/disable")]
    public async Task<ActionResult> Disable(long id, CancellationToken ct)
    { await _users.DisableAsync(id, Uid(), ct); return NoContent(); }

    [HttpPost("{id:long}/enable")]
    public async Task<ActionResult> Enable(long id, CancellationToken ct)
    { await _users.EnableAsync(id, ct); return NoContent(); }

    [HttpPost("{id:long}/reset-password")]
    public async Task<ActionResult> ResetPassword(long id, [FromBody] AdminResetPasswordRequest req, CancellationToken ct)
    { await _users.AdminResetPasswordAsync(id, req.NewPassword, ct); return NoContent(); }
}
