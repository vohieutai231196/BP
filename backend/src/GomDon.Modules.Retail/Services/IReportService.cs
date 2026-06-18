using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Services;

public interface IReportService
{
    Task<ReportBundle> GetAsync(CancellationToken ct = default);
}
