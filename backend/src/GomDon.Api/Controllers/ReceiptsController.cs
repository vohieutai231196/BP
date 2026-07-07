using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/retail/receipts")]
[Authorize]
public sealed class ReceiptsController : ControllerBase
{
    private readonly IReceiptService _receipts;
    public ReceiptsController(IReceiptService receipts) => _receipts = receipts;

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateReceiptRequest req, CancellationToken ct)
    {
        long? uid = long.TryParse(User.FindFirst("uid")?.Value, out var v) ? v : null;
        return Ok(await _receipts.CreateAsync(req, uid, ct));
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? source, [FromQuery] long? supplierId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _receipts.ListAsync(new ReceiptQuery(source, supplierId, page, pageSize), ct));

    [HttpGet("{id:long}")]
    public async Task<ActionResult> Get(long id, CancellationToken ct)
        => await _receipts.GetAsync(id, ct) is { } d ? Ok(d) : NotFound();
}
