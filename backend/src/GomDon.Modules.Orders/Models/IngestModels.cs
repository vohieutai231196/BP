namespace GomDon.Modules.Orders.Models;

/// <summary>
/// Payload extension gửi lên <c>POST /v1/orders/ingest</c>. Các tổng (6),
/// tổng chi phí và còn thiếu được DB tự tính (generated column) — chỉ cần
/// gửi các thành phần phí gốc 1..5, 7..10.
/// </summary>
public sealed class IngestOrderRequest
{
    public long? Id { get; set; }                 // null = tự cấp mã
    public string Status { get; set; } = "cho_coc";
    public string PlatformKey { get; set; } = "taobao";
    public string ProductName { get; set; } = "";
    public string Category { get; set; } = "tech";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Vip { get; set; } = "Vip 1";
    public string Shipping { get; set; } = "Chuyển THƯỜNG";
    public string Warehouse { get; set; } = "Hồ Chí Minh";
    public int BuyFeePct { get; set; } = 1;
    public int Rate { get; set; } = 4035;
    public decimal WeightReal { get; set; }
    public decimal WeightCharged { get; set; }
    public string? Promo { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }   // null = now()

    public IngestCosts Costs { get; set; } = new();
    public IngestTimeline Timeline { get; set; } = new();
    public List<IngestPackage> Packages { get; set; } = new();
    public List<IngestHistory> History { get; set; } = new();
    public List<IngestPayment> Payments { get; set; } = new();
    public List<IngestLink> Links { get; set; } = new();
}

public sealed class IngestLink
{
    public int Idx { get; set; }
    public string LinkCode { get; set; } = "";
    public string? Spec { get; set; }
    public string? SpecVi { get; set; }      // dịch sẵn từ client (nếu có); BE sẽ dịch nếu trống
    public string? Name { get; set; }        // tên SP bóc từ link gốc (tiếng Trung); BE dịch sang Việt
    public string? SourceUrl { get; set; }   // link gốc trên sàn (1688/Taobao/Tmall)
    public string? ImageUrl { get; set; }
    public string? Qty { get; set; }
    public long PriceVnd { get; set; }
    public decimal PriceCny { get; set; }
    public string? Note { get; set; }
}

public sealed class IngestCosts
{
    public long TienHang { get; set; }
    public long PhiTraThem { get; set; }
    public long ShipTQ { get; set; }
    public long PhiMuaHang { get; set; }
    public long PhiKiemDem { get; set; }
    public long TienCanNang { get; set; }
    public long DongGo { get; set; }
    public long CuocPhatSinh { get; set; }
    public long LuuKho { get; set; }
    public long DaThanhToan { get; set; }
}

public sealed class IngestTimeline
{
    public DateTimeOffset? DatCoc { get; set; }
    public DateTimeOffset? DaMua { get; set; }
    public DateTimeOffset? VeVN { get; set; }
    public DateTimeOffset? KhoVN { get; set; }
    public DateTimeOffset? TraHang { get; set; }
}

public sealed class IngestPackage
{
    public string Code { get; set; } = "";
    public decimal Weight { get; set; }
    public decimal WeightCharged { get; set; }
    public long UnitPrice { get; set; }
    public long Total { get; set; }
    public long Extra { get; set; }
    public DateTime? SellerShip { get; set; }
    public DateTime? ToVN { get; set; }
    public DateTime? InVN { get; set; }
}

public sealed class IngestHistory
{
    public DateTimeOffset At { get; set; }
    public string Text { get; set; } = "";
}

public sealed class IngestPayment
{
    public DateTimeOffset At { get; set; }
    public string Reason { get; set; } = "";
    public long Amount { get; set; }
}
