using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IPromotionService
{
    Task<List<PromotionListItem>> ListAsync(CancellationToken ct = default);
    Task<List<long>> GetProductIdsAsync(long id, CancellationToken ct = default);
    Task<long> CreateAsync(CreatePromotionRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdatePromotionRequest req, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
    /// <summary>KM hiệu lực tốt nhất (giá thấp nhất) cho mỗi SKU, tại thời điểm 'now'.</summary>
    Task<List<ActivePromotion>> GetActiveAsync(DateTime now, CancellationToken ct = default);
}
