namespace GomDon.Modules.Retail.Models;

public sealed class Combo
{
    public long Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? ImageUrl { get; set; }
    public long Price { get; set; }
    public bool Active { get; set; } = true;
    public long? PromotionId { get; set; }
}

/// <summary>Thành phần combo kèm dữ liệu SKU (để phân bổ + giãn dòng bán).</summary>
public sealed record ComboComponent(long ProductId, int Qty, string LineType, long ListPrice, long AvgCost, long Stock);

public sealed record ComboListItem(
    long Id, string Code, string Name, string? ImageUrl, long Price, bool Active,
    int ItemCount, long TotalCost, long ListTotal, long AvailableQty);

public sealed record CreateComboItemRequest(long ProductId, int Qty, string? LineType);
public sealed record CreateComboRequest(string Code, string Name, string? ImageUrl, long Price, List<CreateComboItemRequest> Items);
public sealed record UpdateComboRequest(string? Name, string? ImageUrl, long? Price, bool? Active, List<CreateComboItemRequest>? Items);

// dòng combo trong đơn bán
public sealed record CreateSaleComboLine(long ComboId, int Qty);
