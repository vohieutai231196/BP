namespace GomDon.Modules.Retail.Models;

public sealed class Promotion
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Type { get; set; } = "percent";  // percent | fixed
    public long Value { get; set; }
    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public bool Active { get; set; } = true;
}

public sealed record PromotionListItem(
    long Id, string Name, string Type, long Value, DateTime? StartAt, DateTime? EndAt, bool Active, int ProductCount);

public sealed record CreatePromotionRequest(
    string Name, string? Type, long Value, DateTime? StartAt, DateTime? EndAt, List<long>? ProductIds);

public sealed record UpdatePromotionRequest(
    string? Name, string? Type, long? Value, DateTime? StartAt, DateTime? EndAt, bool? Active, List<long>? ProductIds);

/// <summary>KM đang hiệu lực cho một SKU (để FE tự điền giá bán).</summary>
public sealed record ActivePromotion(long ProductId, long PromotionId, string Name, string Type, long Value, long Price);
