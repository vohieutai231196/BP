using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface ICostTypeRepository
{
    Task<List<CostType>> ListAsync(bool activeOnly, CancellationToken ct = default);
    Task<CostType?> GetByIdAsync(long id, CancellationToken ct = default);
    Task<long> InsertAsync(string name, long? defaultAmount, string unit, CancellationToken ct = default);
    Task<bool> UpdateAsync(long id, string name, long? defaultAmount, string unit, bool active, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
}
