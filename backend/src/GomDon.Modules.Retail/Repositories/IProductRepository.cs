using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IProductRepository
{
    Task<List<ProductListItem>> ListAsync(string? status, string? search, CancellationToken ct = default);
    Task<Product?> GetByIdAsync(long id, CancellationToken ct = default);
    Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default);
    Task<long> InsertAsync(CreateProductRequest req, CancellationToken ct = default);
    Task<bool> UpdateAsync(long id, string name, string category, string? imageUrl, long avgCost, long? listPrice, string status, CancellationToken ct = default);
    Task<bool> IsInUseAsync(long id, CancellationToken ct = default);
    Task<bool> HasSalesHistoryAsync(long id, CancellationToken ct = default);
    Task SoftDeleteAsync(long id, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
    Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default);
    Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default);
    Task<List<ProductCostTypeDto>> GetCostTypesAsync(long productId, CancellationToken ct = default);
    Task SetCostTypesAsync(long productId, IReadOnlyList<ProductCostTypeInput> items, CancellationToken ct = default);
}
