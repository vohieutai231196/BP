namespace GomDon.Modules.Retail.Models;

/// <summary>Sản phẩm bán lẻ (SKU). Tồn kho tính từ stock_movements (GĐ2); GĐ1 nhập avg_cost tay.</summary>
public sealed class Product
{
    public long Id { get; set; }
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string? ImageUrl { get; set; }
    public string Status { get; set; } = "active";   // active | hidden
    public long AvgCost { get; set; }                 // giá vốn TB (₫)
    public long? ListPrice { get; set; }              // giá niêm yết (₫)
    public DateTime CreatedAt { get; set; }
}

// ---------- DTO / request ----------
public sealed record ProductListItem(
    long Id, string Sku, string Name, string Category,
    string? ImageUrl, string Status, long AvgCost, long? ListPrice, DateTime CreatedAt, long Stock);

public sealed record CreateProductRequest(
    string Sku, string Name, string? Category, string? ImageUrl, long AvgCost, long? ListPrice);

public sealed record UpdateProductRequest(
    string? Name, string? Category, string? ImageUrl, long? AvgCost, long? ListPrice, string? Status);

public sealed class CostType
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public long? DefaultAmount { get; set; }
    public string Unit { get; set; } = "vnd";   // vnd | percent
    public bool Active { get; set; } = true;
}

public sealed record CreateCostTypeRequest(string Name, long? DefaultAmount, string? Unit);
public sealed record UpdateCostTypeRequest(string? Name, long? DefaultAmount, string? Unit, bool? Active);
