using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface ISaleService
{
    Task<List<SaleListItem>> ListAsync(CancellationToken ct = default);
    Task<long> CreateAsync(CreateSaleRequest req, CancellationToken ct = default);
}
