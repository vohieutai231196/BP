using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Authorize]
public sealed class StockController : ControllerBase
{
    private readonly IStockService _stock;
    public StockController(IStockService stock) => _stock = stock;

    /// <summary>Thẻ kho: lịch sử nhập-xuất-điều chỉnh của một SKU.</summary>
    [HttpGet("v1/products/{id:long}/movements")]
    public async Task<ActionResult> Movements(long id, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(await _stock.ListMovementsAsync(id, page, pageSize, ct));

    /// <summary>Điều chỉnh tồn về số thực tế (kiểm kê/hỏng/mất).</summary>
    [HttpPost("v1/retail/stock/adjust")]
    public async Task<ActionResult> Adjust([FromBody] AdjustStockRequest req, CancellationToken ct)
        => Ok(await _stock.AdjustAsync(req, ct));
}
