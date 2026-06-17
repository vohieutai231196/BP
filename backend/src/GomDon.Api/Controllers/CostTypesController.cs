using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/cost-types")]
[Authorize]
public sealed class CostTypesController : ControllerBase
{
    private readonly ICostTypeService _costs;
    public CostTypesController(ICostTypeService costs) => _costs = costs;

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default)
        => Ok(await _costs.ListAsync(activeOnly, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCostTypeRequest req, CancellationToken ct)
        => Ok(await _costs.CreateAsync(req, ct));

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdateCostTypeRequest req, CancellationToken ct)
    { await _costs.UpdateAsync(id, req, ct); return NoContent(); }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    { await _costs.DeleteAsync(id, ct); return NoContent(); }
}
