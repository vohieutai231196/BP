using GomDon.Modules.Orders.Models;
using GomDon.Shared;

namespace GomDon.Modules.Orders.Repositories;

public interface IOrderRepository
{
    Task<PagedResult<OrderSummary>> ListAsync(OrderQuery query, CancellationToken ct = default);
    Task<OrderDetail?> GetByIdAsync(long id, CancellationToken ct = default);
    Task<long> IngestAsync(IngestOrderRequest req, CancellationToken ct = default);
    Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default);
    Task<int> CountAsync(CancellationToken ct = default);
    Task<bool> UpdateStatusAsync(long id, string status, string historyText, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
}
