using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;
    private readonly IConfiguration _config;
    private readonly ILogger<OrdersController> _log;

    public OrdersController(IOrderService orders, IConfiguration config, ILogger<OrdersController> log)
    {
        _orders = orders; _config = config; _log = log;
    }

    /// <summary>Danh sách đơn (lọc/tìm/sắp xếp/phân trang) — yêu cầu đăng nhập.</summary>
    [Authorize]
    [HttpGet]
    public async Task<ActionResult> List([FromQuery] OrderQuery query, CancellationToken ct)
        => Ok(await _orders.ListAsync(query, ct));

    /// <summary>Chi tiết một đơn — yêu cầu đăng nhập.</summary>
    [Authorize]
    [HttpGet("{id:long}")]
    public async Task<ActionResult> Get(long id, CancellationToken ct)
    {
        var order = await _orders.GetAsync(id, ct);
        return order is null ? NotFound(new { message = $"Không tìm thấy đơn #{id}" }) : Ok(order);
    }

    /// <summary>
    /// Nhận đơn từ Chrome Extension. Xác thực bằng header <c>X-Api-Key</c>
    /// (so với cấu hình Ingest:Token).
    /// </summary>
    [AllowAnonymous]
    [EnableRateLimiting("ingest")]
    [HttpPost("ingest")]
    public async Task<ActionResult> Ingest([FromBody] IngestOrderRequest req,
        [FromHeader(Name = "X-Api-Key")] string? apiKey, CancellationToken ct)
    {
        var expected = _config["Ingest:Token"];
        if (string.IsNullOrEmpty(expected) || apiKey != expected)
            return Unauthorized(new { message = "X-Api-Key không hợp lệ." });

        // Lỗi validate (FluentValidation) tự được GlobalExceptionHandler trả về 400.
        var id = await _orders.IngestAsync(req, ct);
        _log.LogInformation("Ingest thành công đơn #{Id} từ extension.", id);
        return CreatedAtAction(nameof(Get), new { id }, new { id });
    }

    /// <summary>Đổi trạng thái đơn (ghi kèm lịch sử) — yêu cầu đăng nhập.</summary>
    [Authorize]
    [HttpPatch("{id:long}/status")]
    public async Task<ActionResult> ChangeStatus(long id, [FromBody] ChangeStatusRequest body, CancellationToken ct)
    {
        var ok = await _orders.ChangeStatusAsync(id, body.Status, body.Note, ct);
        if (!ok) return NotFound(new { message = $"Không tìm thấy đơn #{id}" });
        _log.LogInformation("Đơn #{Id} đổi trạng thái → {Status}", id, body.Status);
        return Ok(await _orders.GetAsync(id, ct));
    }

    /// <summary>Xoá đơn (và toàn bộ kiện/phí/lịch sử/thanh toán/sản phẩm) — yêu cầu đăng nhập.</summary>
    [Authorize]
    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id, CancellationToken ct)
    {
        var ok = await _orders.DeleteAsync(id, ct);
        if (!ok) return NotFound(new { message = $"Không tìm thấy đơn #{id}" });
        _log.LogInformation("Đã xoá đơn #{Id}.", id);
        return NoContent();
    }
}
