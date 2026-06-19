using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IRetailSummaryService
{
    Task<RetailSummary> GetAsync(CancellationToken ct = default);
    Task<List<ImportBatch>> ListImportsAsync(CancellationToken ct = default);
}
