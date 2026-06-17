using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IRetailSummaryRepository
{
    Task<RetailSummary> GetAsync(int lowStockThreshold, CancellationToken ct = default);
}
