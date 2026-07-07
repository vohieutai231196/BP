namespace GomDon.Modules.Retail.Models;

// ----- Lệnh ghi phiếu nhập (nội bộ — dùng chung cho manual/opening/order) -----
public sealed record ReceiptLineCommand(
    long? ProductId, string? NewSku, string? NewName, string? Category, string? ImageUrl,
    int Qty, long UnitCost, long? OrderLinkId = null, string? LinkCode = null);

public sealed record CreateReceiptCommand(
    string Source,                 // order | manual | opening
    long? OrderId, long? SupplierId, string? Note, DateTime? ReceivedAt, long? CreatedBy,
    IReadOnlyList<ReceiptLineCommand> Lines);

public sealed record ReceiptCreated(long Id, string Code, int LineCount);

// ----- API DTO -----
public sealed record NewProductInput(string Sku, string Name, string? Category, long? ListPrice);
public sealed record CreateReceiptItemRequest(long? ProductId, NewProductInput? NewProduct, int Qty, long UnitCost);

public sealed class CreateReceiptRequest
{
    public string Source { get; set; } = "manual";   // manual | opening
    public long? SupplierId { get; set; }
    public string? Note { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public List<CreateReceiptItemRequest> Items { get; set; } = new();
}

public sealed record ReceiptListItem(
    long Id, string Code, string Source, long? OrderId, long? SupplierId, string? SupplierName,
    string? Note, long TotalCost, int SkuCount, long TotalQty, DateTime ReceivedAt);

public sealed record ReceiptItemDetail(long ProductId, string Sku, string Name, string? ImageUrl, int Qty, long UnitCost);

public sealed class ReceiptDetail
{
    public long Id { get; set; }
    public string Code { get; set; } = "";
    public string Source { get; set; } = "";
    public long? OrderId { get; set; }
    public long? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string? Note { get; set; }
    public long TotalCost { get; set; }
    public DateTime ReceivedAt { get; set; }
    public List<ReceiptItemDetail> Items { get; set; } = new();
}

public sealed record ReceiptQuery(string? Source = null, long? SupplierId = null, int Page = 1, int PageSize = 20);
