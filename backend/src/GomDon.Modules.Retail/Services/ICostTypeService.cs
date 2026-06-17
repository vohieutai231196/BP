using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface ICostTypeService
{
    Task<List<CostType>> ListAsync(bool activeOnly, CancellationToken ct = default);
    Task<CostType> CreateAsync(CreateCostTypeRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdateCostTypeRequest req, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
}
