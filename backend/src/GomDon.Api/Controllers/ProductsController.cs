using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/products")]
[Authorize]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductService _products;
    public ProductsController(IProductService products) => _products = products;

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] string? status, [FromQuery] string? search, CancellationToken ct)
        => Ok(await _products.ListAsync(status, search, ct));

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateProductRequest req, CancellationToken ct)
        => Ok(await _products.CreateAsync(req, ct));

    [HttpPatch("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] UpdateProductRequest req, CancellationToken ct)
    { await _products.UpdateAsync(id, req, ct); return NoContent(); }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    { await _products.DeleteAsync(id, ct); return NoContent(); }
}
