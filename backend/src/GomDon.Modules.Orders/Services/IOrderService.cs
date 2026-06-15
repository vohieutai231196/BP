using GomDon.Modules.Orders.Models;
using GomDon.Shared;

namespace GomDon.Modules.Orders.Services;

public interface IOrderService
{
    Task<PagedResult<OrderSummary>> ListAsync(OrderQuery query, CancellationToken ct = default);
    Task<OrderDetail?> GetAsync(long id, CancellationToken ct = default);
    Task<long> IngestAsync(IngestOrderRequest req, CancellationToken ct = default);
    Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default);
    Task<bool> ChangeStatusAsync(long id, string status, string? note, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
}
