using GomDon.Modules.Retail.Models;
using GomDon.Shared;

namespace GomDon.Modules.Retail.Services;

public interface IStockService
{
    Task<PagedResult<StockMovementItem>> ListMovementsAsync(long productId, int page, int pageSize, CancellationToken ct = default);
    Task<StockAdjustResult> AdjustAsync(AdjustStockRequest req, CancellationToken ct = default);
}
