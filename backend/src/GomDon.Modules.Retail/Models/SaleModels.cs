namespace GomDon.Modules.Retail.Models;

// ----- request tạo đơn bán -----
public sealed record CreateSaleItemRequest(long ProductId, int Qty, long UnitPrice, string? LineType = null, long? PromoId = null); // ban|tang
public sealed record CreateSaleCostRequest(long? CostTypeId, string Name, long Amount, string Unit); // Unit: vnd|percent
public sealed class CreateSaleRequest
{
    public string? CustomerName { get; set; }
    public string? Channel { get; set; }
    public List<CreateSaleItemRequest> Items { get; set; } = new();
    public List<CreateSaleComboLine> Combos { get; set; } = new();
    public List<CreateSaleCostRequest> Costs { get; set; } = new();
}

// ----- dòng đã chốt giá vốn (service điền unit_cost từ avg_cost) -----
public sealed record PricedSaleItem(long ProductId, int Qty, long UnitPrice, long UnitCost, string LineType, long? PromoId = null);

// ----- kết quả tính toán đơn -----
public sealed record SaleTotals(long Revenue, long Cogs, long PromoCost, long ExtraCost, long Profit);

// ----- đọc đơn bán (qua Dapper → class get/set để tự ép kiểu/khớp cột) -----
public sealed class SaleListItem
{
    public long Id { get; set; }
    public string Code { get; set; } = "";
    public string? CustomerName { get; set; }
    public string? Channel { get; set; }
    public DateTime SoldAt { get; set; }
    public long Revenue { get; set; }
    public long Cogs { get; set; }
    public long PromoCost { get; set; }
    public long ExtraCost { get; set; }
    public long Profit { get; set; }
    public int ItemCount { get; set; }
    public string Status { get; set; } = "done";
    public DateTime? ReturnedAt { get; set; }
}
