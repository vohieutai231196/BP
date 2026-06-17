using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IProductService
{
    Task<List<ProductListItem>> ListAsync(string? status, string? search, CancellationToken ct = default);
    Task<ProductListItem> CreateAsync(CreateProductRequest req, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdateProductRequest req, CancellationToken ct = default);
    Task DeleteAsync(long id, CancellationToken ct = default);
}
