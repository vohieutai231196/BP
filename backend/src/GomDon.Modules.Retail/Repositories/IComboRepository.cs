using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IComboRepository
{
    Task<List<ComboListItem>> ListAsync(CancellationToken ct = default);
    Task<Combo?> GetByIdAsync(long id, CancellationToken ct = default);
    /// <summary>Thành phần combo kèm dữ liệu SKU (list_price, avg_cost, tồn hiện tại).</summary>
    Task<List<ComboComponent>> GetComponentsAsync(long comboId, CancellationToken ct = default);
    Task<long> InsertAsync(CreateComboRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, string name, string? imageUrl, long price, bool active, IReadOnlyList<CreateComboItemRequest>? items, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
}
