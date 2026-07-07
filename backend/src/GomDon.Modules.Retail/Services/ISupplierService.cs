using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface ISupplierService
{
    Task<List<Supplier>> ListAsync(bool activeOnly, CancellationToken ct = default);
    Task<Supplier> CreateAsync(SupplierRequest req, CancellationToken ct = default);
    Task<bool> UpdateAsync(long id, SupplierRequest req, CancellationToken ct = default);
    Task<SupplierDeleteOutcome> DeleteAsync(long id, CancellationToken ct = default);
}
