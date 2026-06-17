using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IPromotionRepository
{
    Task<List<PromotionListItem>> ListAsync(CancellationToken ct = default);
    Task<Promotion?> GetByIdAsync(long id, CancellationToken ct = default);
    Task<List<long>> GetProductIdsAsync(long promotionId, CancellationToken ct = default);
    Task<long> InsertAsync(string name, string type, long value, DateTime? startAt, DateTime? endAt, IReadOnlyList<long> productIds, CancellationToken ct = default);
    Task UpdateAsync(long id, string name, string type, long value, DateTime? startAt, DateTime? endAt, bool active, IReadOnlyList<long> productIds, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
    /// <summary>SKU + list_price của các SKU đang có KM hiệu lực tại 'now'.</summary>
    Task<List<(long ProductId, long ListPrice, long PromotionId, string Name, string Type, long Value)>> GetActiveRawAsync(DateTime now, CancellationToken ct = default);
}
