namespace GomDon.Modules.Retail.Models;

// ----- request tạo đơn bán -----
public sealed record CreateSaleItemRequest(long ProductId, int Qty, long UnitPrice, string? LineType = null); // ban|tang
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
public sealed record PricedSaleItem(long ProductId, int Qty, long UnitPrice, long UnitCost, string LineType);

// ----- kết quả tính toán đơn -----
public sealed record SaleTotals(long Revenue, long Cogs, long PromoCost, long ExtraCost, long Profit);

// ----- đọc đơn bán -----
public sealed record SaleListItem(
    long Id, string Code, string? CustomerName, string? Channel, DateTime SoldAt,
    long Revenue, long Cogs, long PromoCost, long ExtraCost, long Profit, int ItemCount);
