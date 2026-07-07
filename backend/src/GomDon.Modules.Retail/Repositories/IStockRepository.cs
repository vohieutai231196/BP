using GomDon.Modules.Retail.Models;
using GomDon.Shared;

namespace GomDon.Modules.Retail.Repositories;

public interface IStockRepository
{
    /// <summary>Tồn hiện tại của 1 SKU (đọc product_stock).</summary>
    Task<long> GetStockAsync(long productId, CancellationToken ct = default);
    /// <summary>Ghi một dòng phát sinh kho.</summary>
    Task InsertMovementAsync(long productId, string type, int qty, long unitCost, string? refType, long? refId, string? note, CancellationToken ct = default);
    /// <summary>Thẻ kho: lịch sử phát sinh của 1 SKU, mới nhất trước.</summary>
    Task<PagedResult<StockMovementItem>> ListMovementsAsync(long productId, int page, int pageSize, CancellationToken ct = default);
    /// <summary>Điều chỉnh tồn về số thực tế (ghi movement 'adjust' + set product_stock).</summary>
    Task<StockAdjustResult> AdjustAsync(long productId, long actualQty, string reason, CancellationToken ct = default);
}
