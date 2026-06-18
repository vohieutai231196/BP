namespace GomDon.Modules.Retail.Models;

public sealed record ChannelProfit(string Channel, int SalesCount, long Revenue, long Profit);
public sealed record SkuProfit(long ProductId, string Sku, string Name, long QtySold, long Revenue, long Margin);
public sealed record ReportBundle(List<ChannelProfit> ByChannel, List<SkuProfit> BySku);
