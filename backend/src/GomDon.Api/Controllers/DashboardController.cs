using GomDon.Modules.Orders.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GomDon.Api.Controllers;

[ApiController]
[Route("v1/dashboard")]
[Authorize]
public sealed class DashboardController : ControllerBase
{
    private readonly IOrderService _orders;
    public DashboardController(IOrderService orders) => _orders = orders;

    /// <summary>KPI, chuỗi 14 ngày, thống kê trạng thái/sàn/kho cho trang Tổng quan.</summary>
    [HttpGet("summary")]
    public async Task<ActionResult> Summary(CancellationToken ct)
        => Ok(await _orders.GetDashboardAsync(ct));
}
