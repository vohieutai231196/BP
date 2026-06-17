using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/retail/receive")]
[Authorize]
public sealed class ReceiveController : ControllerBase
{
    private readonly IReceiveService _receive;
    public ReceiveController(IReceiveService receive) => _receive = receive;

    [HttpGet("preview/{orderId:long}")]
    public async Task<ActionResult> Preview(long orderId, CancellationToken ct)
        => Ok(await _receive.PreviewAsync(orderId, ct));

    [HttpPost("confirm")]
    public async Task<ActionResult> Confirm([FromBody] ConfirmReceiveRequest req, CancellationToken ct)
        => Ok(new { received = await _receive.ConfirmAsync(req, ct) });
}
