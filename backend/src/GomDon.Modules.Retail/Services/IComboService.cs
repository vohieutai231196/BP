using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IComboService
{
    Task<List<ComboListItem>> ListAsync(CancellationToken ct = default);
    Task<List<ComboComponent>> GetComponentsAsync(long id, CancellationToken ct = default);
    Task<long> CreateAsync(CreateComboRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdateComboRequest req, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
}
