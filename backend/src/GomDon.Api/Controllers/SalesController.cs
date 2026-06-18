using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/sales")]
[Authorize]
public sealed class SalesController : ControllerBase
{
    private readonly ISaleService _sales;
    public SalesController(ISaleService sales) => _sales = sales;

    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct) => Ok(await _sales.ListAsync(ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateSaleRequest req, CancellationToken ct)
        => Ok(new { id = await _sales.CreateAsync(req, ct) });

    [HttpPost("{id:long}/return")]
    public async Task<ActionResult> Return(long id, CancellationToken ct)
    { await _sales.ReturnAsync(id, ct); return NoContent(); }
}
