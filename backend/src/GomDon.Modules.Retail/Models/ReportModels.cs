namespace GomDon.Modules.Retail.Models;

// DTO đọc qua Dapper → dùng class get/set để Dapper map theo property
// (tự ép kiểu numeric/bigint→long, COUNT bigint→int và khớp snake_case).
public sealed class ChannelProfit
{
    public string Channel { get; set; } = "";
    public int SalesCount { get; set; }
    public long Revenue { get; set; }
    public long Profit { get; set; }
}

public sealed class SkuProfit
{
    public long ProductId { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public long QtySold { get; set; }
    public long Revenue { get; set; }
    public long Margin { get; set; }
}

public sealed class PromotionProfit
{
    public long PromotionId { get; set; }
    public string Name { get; set; } = "";
    public long QtySold { get; set; }
    public long Revenue { get; set; }
    public long Margin { get; set; }
}

// Bundle dựng trong code (không qua Dapper) → giữ record.
public sealed record ReportBundle(List<ChannelProfit> ByChannel, List<SkuProfit> BySku, List<PromotionProfit> ByPromotion);
