using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/suppliers")]
[Authorize]
public sealed class SuppliersController : ControllerBase
{
    private readonly ISupplierService _suppliers;
    public SuppliersController(ISupplierService suppliers) => _suppliers = suppliers;

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] bool activeOnly = false, CancellationToken ct = default)
        => Ok(await _suppliers.ListAsync(activeOnly, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SupplierRequest req, CancellationToken ct)
        => Ok(await _suppliers.CreateAsync(req, ct));

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] SupplierRequest req, CancellationToken ct)
        => await _suppliers.UpdateAsync(id, req, ct) ? NoContent() : NotFound();

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
        => await _suppliers.DeleteAsync(id, ct) switch
        {
            SupplierDeleteOutcome.Deleted     => NoContent(),
            SupplierDeleteOutcome.Deactivated => Ok(new { deactivated = true }),
            _                                 => NotFound(),
        };
}
