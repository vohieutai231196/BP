namespace GomDon.Modules.Orders.Models;

/// <summary>Tóm tắt đơn — dùng cho data grid / danh sách.</summary>
public sealed class OrderSummary
{
    public long Id { get; set; }
    public string Status { get; set; } = "";
    public string PlatformKey { get; set; } = "";
    public string PlatformLabel { get; set; } = "";
    public string PlatformTint { get; set; } = "";
    public string ProductName { get; set; } = "";
    public string Category { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string CustomerPhone { get; set; } = "";
    public string Vip { get; set; } = "";
    public int PackagesCount { get; set; }
    public decimal WeightReal { get; set; }
    public long TongChiPhi { get; set; }
    public long DaThanhToan { get; set; }
    public long ConThieu { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Chi tiết đơn đầy đủ — drawer / trang chi tiết.</summary>
public sealed class OrderDetail
{
    public long Id { get; set; }
    public string Status { get; set; } = "";
    public PlatformDto Platform { get; set; } = new();
    public string ProductName { get; set; } = "";
    public string Category { get; set; } = "";
    public CustomerDto Customer { get; set; } = new();
    public string Vip { get; set; } = "";
    public string Shipping { get; set; } = "";
    public string Warehouse { get; set; } = "";
    public int BuyFeePct { get; set; }
    public int Rate { get; set; }
    public decimal WeightReal { get; set; }
    public decimal WeightCharged { get; set; }
    public int PackagesCount { get; set; }
    public string? Promo { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public CostsDto Costs { get; set; } = new();
    public TimelineDto Timeline { get; set; } = new();
    public List<PackageDto> Packages { get; set; } = new();
    public List<HistoryDto> History { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
    public List<LinkDto> Links { get; set; } = new();
}

public sealed class LinkDto
{
    public int Idx { get; set; }
    public string LinkCode { get; set; } = "";
    public string? Spec { get; set; }
    public string? SpecVi { get; set; }
    public string? Name { get; set; }
    public string? SourceUrl { get; set; }
    public string? ImageUrl { get; set; }
    public string? Qty { get; set; }
    public long PriceVnd { get; set; }
    public decimal PriceCny { get; set; }
    public string? Note { get; set; }
}

public sealed class PlatformDto
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";
    public string Tint { get; set; } = "";
}

public sealed class CustomerDto
{
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
}

/// <summary>Công thức phí 1..10 (xem trang Tổng phí).</summary>
public sealed class CostsDto
{
    public long TienHang { get; set; }       // (1)
    public long PhiTraThem { get; set; }      // (2)
    public long ShipTQ { get; set; }          // (3)
    public long PhiMuaHang { get; set; }      // (4)
    public long PhiKiemDem { get; set; }      // (5)
    public long TongTienHang { get; set; }    // (6) = 1+2+3+4+5
    public long TienCanNang { get; set; }     // (7)
    public long DongGo { get; set; }          // (8)
    public long CuocPhatSinh { get; set; }    // (9)
    public long LuuKho { get; set; }          // (10)
    public long TongChiPhi { get; set; }      // 6+7+8+9+10
    public long DaThanhToan { get; set; }
    public long ConThieu { get; set; }
}

public sealed class TimelineDto
{
    public DateTimeOffset? DatCoc { get; set; }
    public DateTimeOffset? DaMua { get; set; }
    public DateTimeOffset? VeVN { get; set; }
    public DateTimeOffset? KhoVN { get; set; }
    public DateTimeOffset? TraHang { get; set; }
}

public sealed class PackageDto
{
    public string Code { get; set; } = "";
    public decimal Weight { get; set; }
    public decimal WeightCharged { get; set; }
    public long UnitPrice { get; set; }
    public long Total { get; set; }
    public long Extra { get; set; }
    public DateOnly? SellerShip { get; set; }
    public DateOnly? ToVN { get; set; }
    public DateOnly? InVN { get; set; }
}

public sealed class HistoryDto
{
    public DateTimeOffset At { get; set; }
    public string Text { get; set; } = "";
}

public sealed class PaymentDto
{
    public DateTimeOffset At { get; set; }
    public string Reason { get; set; } = "";
    public long Amount { get; set; }
}

/// <summary>Bộ lọc danh sách đơn.</summary>
public sealed class OrderQuery
{
    public string? Status { get; set; }
    public bool PayOnly { get; set; }
    public string? Search { get; set; }
    public string Sort { get; set; } = "date"; // date|value|weight|due
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public bool All { get; set; } = false;     // true = lấy hết (cho export CSV)
}

/// <summary>Yêu cầu đổi trạng thái đơn.</summary>
public sealed class ChangeStatusRequest
{
    public string Status { get; set; } = "";
    public string? Note { get; set; }
}
