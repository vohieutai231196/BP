using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;

namespace GomDon.Modules.Retail.Services;

public sealed class ReportService : IReportService
{
    private readonly IReportRepository _repo;
    public ReportService(IReportRepository repo) => _repo = repo;

    public async Task<ReportBundle> GetAsync(CancellationToken ct = default)
        => new(await _repo.ByChannelAsync(ct), await _repo.BySkuAsync(ct));
}
