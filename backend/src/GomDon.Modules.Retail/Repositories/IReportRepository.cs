using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface IReportRepository
{
    Task<List<ChannelProfit>> ByChannelAsync(CancellationToken ct = default);
    Task<List<SkuProfit>> BySkuAsync(CancellationToken ct = default);
    Task<List<PromotionProfit>> ByPromotionAsync(CancellationToken ct = default);
}
