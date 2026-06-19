using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;

namespace GomDon.Modules.Retail.Services;

public sealed class RetailSummaryService : IRetailSummaryService
{
    private const int LowStockThreshold = 10;
    private readonly IRetailSummaryRepository _repo;
    public RetailSummaryService(IRetailSummaryRepository repo) => _repo = repo;
    public Task<RetailSummary> GetAsync(CancellationToken ct = default) => _repo.GetAsync(LowStockThreshold, ct);
    public Task<List<ImportBatch>> ListImportsAsync(CancellationToken ct = default) => _repo.ListImportsAsync(ct);
}
