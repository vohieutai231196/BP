namespace GomDon.Modules.Retail.Models;

public sealed class Supplier
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string? Phone { get; set; }
    public string? Note { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }
}

public sealed record SupplierRequest(string Name, string? Phone, string? Note, bool? Active);

/// <summary>Kết quả xoá NCC: xoá hẳn, hay chỉ ngưng hoạt động vì đã có phiếu nhập tham chiếu.</summary>
public enum SupplierDeleteOutcome { Deleted, Deactivated, NotFound }
