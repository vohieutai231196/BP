namespace GomDon.Modules.Retail.Models;

/// <summary>Một link cần phân bổ giá vốn (từ đơn mua hộ).</summary>
public sealed record AllocInput(long OrderLinkId, long PriceVnd, int Qty);

/// <summary>Kết quả phân bổ cho một link.</summary>
public sealed record AllocResult(long OrderLinkId, long LandedTotal, long UnitCost);

// ----- Preview / confirm nhận đơn vào kho -----
public sealed class ReceiveLinePreview
{
    public long OrderLinkId { get; set; }
    public string LinkCode { get; set; } = "";
    public string? Spec { get; set; }
    public string? SpecVi { get; set; }
    public string? ImageUrl { get; set; }
    public long PriceVnd { get; set; }
    public int Qty { get; set; }
    public long UnitCost { get; set; }            // sau phân bổ
    public long? SuggestedProductId { get; set; } // null = chưa khớp → tạo mới
    public string SuggestedSku { get; set; } = "";
    public string SuggestedName { get; set; } = "";
}

public sealed class ReceivePreview
{
    public long OrderId { get; set; }
    public long SharedCost { get; set; }
    public List<ReceiveLinePreview> Lines { get; set; } = new();
}

public sealed record ConfirmReceiveLine(
    long OrderLinkId, string LinkCode, long? ProductId, string? NewSku, string? NewName,
    string? Category, string? ImageUrl, int Qty, long UnitCost);

public sealed class ConfirmReceiveRequest
{
    public long OrderId { get; set; }
    public List<ConfirmReceiveLine> Lines { get; set; } = new();
}
