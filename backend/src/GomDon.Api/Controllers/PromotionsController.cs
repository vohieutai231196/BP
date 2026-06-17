using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/promotions")]
[Authorize]
public sealed class PromotionsController : ControllerBase
{
    private readonly IPromotionService _promos;
    public PromotionsController(IPromotionService promos) => _promos = promos;

    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct) => Ok(await _promos.ListAsync(ct));

    [HttpGet("{id:long}/products")]
    public async Task<ActionResult> Products(long id, CancellationToken ct) => Ok(await _promos.GetProductIdsAsync(id, ct));

    [HttpGet("active")]
    public async Task<ActionResult> Active(CancellationToken ct) => Ok(await _promos.GetActiveAsync(DateTime.UtcNow, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreatePromotionRequest req, CancellationToken ct)
        => Ok(new { id = await _promos.CreateAsync(req, ct) });

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdatePromotionRequest req, CancellationToken ct)
    { await _promos.UpdateAsync(id, req, ct); return NoContent(); }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    { await _promos.DeleteAsync(id, ct); return NoContent(); }
}
