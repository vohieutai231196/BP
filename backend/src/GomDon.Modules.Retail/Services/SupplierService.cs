using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class SupplierService : ISupplierService
{
    private readonly ISupplierRepository _repo;
    public SupplierService(ISupplierRepository repo) => _repo = repo;

    public Task<List<Supplier>> ListAsync(bool activeOnly, CancellationToken ct = default)
        => _repo.ListAsync(activeOnly, ct);

    public Task<Supplier> CreateAsync(SupplierRequest req, CancellationToken ct = default)
        => _repo.CreateAsync(Normalize(req), ct);

    public Task<bool> UpdateAsync(long id, SupplierRequest req, CancellationToken ct = default)
        => _repo.UpdateAsync(id, Normalize(req), ct);

    public Task<SupplierDeleteOutcome> DeleteAsync(long id, CancellationToken ct = default)
        => _repo.DeleteAsync(id, ct);

    private static SupplierRequest Normalize(SupplierRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (name.Length == 0) throw new ValidationException("Tên nhà cung cấp không được trống.");
        if (name.Length > 120) throw new ValidationException("Tên nhà cung cấp tối đa 120 ký tự.");
        return req with { Name = name };
    }
}
