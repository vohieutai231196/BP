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
public sealed record ProductSourceRef(long OrderId, long Qty);

public sealed record ProductListItem(
    long Id, string Sku, string Name, string Category,
    string? ImageUrl, string Status, long AvgCost, long? ListPrice, DateTime CreatedAt, long Stock,
    string? CostTypeSummary = null,                       // "Fee ship, Bao bì" (string_agg)
    IReadOnlyList<ProductSourceRef>? SourceOrders = null);  // đơn đã nhập kho SKU này (mới→cũ)

public sealed record ProductCostTypeInput(long CostTypeId, long? Amount);
public sealed record ProductCostTypeDto(long CostTypeId, string Name, string Unit, long Amount); // Amount đã resolve

public sealed record CreateProductRequest(
    string Sku, string Name, string? Category, string? ImageUrl, long AvgCost, long? ListPrice,
    List<ProductCostTypeInput>? CostTypes = null);

public sealed record UpdateProductRequest(
    string? Name, string? Category, string? ImageUrl, long? AvgCost, long? ListPrice, string? Status,
    List<ProductCostTypeInput>? CostTypes = null);

// ---------- Xóa nhiều / xóa cả lô ----------
public sealed record BulkDeleteRequest(List<long> Ids);
public sealed record BulkDeleteBlocked(long Id, string Sku, string Reason);
/// <summary>Kết quả xóa hàng loạt: số xóa hẳn, số ẩn (còn lịch sử bán), danh sách bị chặn (đang dùng).</summary>
public sealed record BulkDeleteResult(int Deleted, int Hidden, IReadOnlyList<BulkDeleteBlocked> Blocked);

public sealed class CostType
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public long? DefaultAmount { get; set; }
    public string Unit { get; set; } = "vnd";   // vnd | percent | pack
    public bool Active { get; set; } = true;
    public long? PackPrice { get; set; }         // giá lô (₫) khi unit='pack'
    public int? PackSize { get; set; }           // số đơn vị/lô khi unit='pack'
}

public sealed record CreateCostTypeRequest(string Name, long? DefaultAmount, string? Unit, long? PackPrice = null, int? PackSize = null);
public sealed record UpdateCostTypeRequest(string? Name, long? DefaultAmount, string? Unit, bool? Active, long? PackPrice = null, int? PackSize = null);
