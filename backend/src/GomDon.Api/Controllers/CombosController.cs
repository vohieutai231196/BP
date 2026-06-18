using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/combos")]
[Authorize]
public sealed class CombosController : ControllerBase
{
    private readonly IComboService _combos;
    public CombosController(IComboService combos) => _combos = combos;

    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct) => Ok(await _combos.ListAsync(ct));

    [HttpGet("{id:long}/components")]
    public async Task<ActionResult> Components(long id, CancellationToken ct) => Ok(await _combos.GetComponentsAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateComboRequest req, CancellationToken ct)
        => Ok(new { id = await _combos.CreateAsync(req, ct) });

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdateComboRequest req, CancellationToken ct)
    { await _combos.UpdateAsync(id, req, ct); return NoContent(); }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    { await _combos.DeleteAsync(id, ct); return NoContent(); }
}
