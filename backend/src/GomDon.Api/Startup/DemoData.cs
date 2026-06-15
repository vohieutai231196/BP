using GomDon.Modules.Orders.Models;

namespace GomDon.Api.Startup;

/// <summary>
/// Sinh đơn demo có tính tất định (seeded RNG) — mô phỏng đúng công thức phí
/// và vòng đời như prototype FE (data.js), để dashboard/grid có dữ liệu thật.
/// </summary>
public static class DemoData
{
    private static readonly string[] Platforms = { "taobao", "1688", "pdd", "tmall", "weidian" };
    private static readonly (string name, string cat)[] Products =
    {
        ("Giày sneaker nữ da PU", "shoe"), ("Túi xách thời trang", "bag"),
        ("Áo khoác dạ nam form rộng", "apparel"), ("Tai nghe bluetooth TWS", "tech"),
        ("Đồng hồ thông minh", "tech"), ("Bộ nồi inox 304", "home"),
        ("Balo laptop chống nước", "bag"), ("Váy liền thân nữ", "apparel"),
        ("Chuột không dây gaming", "tech"), ("Giày thể thao nam", "shoe"),
        ("Bình giữ nhiệt 500ml", "home"), ("Áo hoodie unisex", "apparel"),
    };
    private static readonly string[] First = { "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ" };
    private static readonly string[] Mid = { "Thị", "Văn", "Minh", "Quốc", "Thanh", "Hữu", "Gia", "Ngọc", "Hải" };
    private static readonly string[] Last = { "An", "Bình", "Châu", "Dũng", "Hà", "Khoa", "Linh", "Mai", "Nam", "Trang", "Vy" };
    private static readonly string[] Warehouses = { "Hồ Chí Minh", "Hà Nội", "Đà Nẵng" };
    private static readonly string[] Shipping = { "Chuyển THƯỜNG", "Chuyển NHANH", "Chuyển VIP", "Tiết kiệm" };
    private static readonly string[] Vips = { "Vip 1", "Vip 2", "Vip 3", "Vip 4", "Vip 5" };
    private static readonly string[] StatusPool =
    {
        "da_tra", "da_tra", "da_tra", "kho_vn", "kho_vn", "ve_vn", "ve_vn", "ve_vn",
        "dang_mua", "dang_mua", "cho_coc", "cho_coc", "khieu_nai", "huy", "thanh_ly",
    };

    public static List<IngestOrderRequest> Generate(int count)
    {
        var rng = new Random(20260613);
        int Rint(int a, int b) => a + rng.Next(b - a + 1);
        T Pick<T>(T[] arr) => arr[rng.Next(arr.Length)];

        var today = DateTime.UtcNow.Date;
        var list = new List<IngestOrderRequest>();

        for (var i = 0; i < count; i++)
        {
            var status = i < StatusPool.Length ? StatusPool[i] : Pick(StatusPool);
            var (pname, cat) = Pick(Products);
            var rate = Pick(new[] { 4035, 4035, 4035, 4010, 4060 });
            var buyPct = Pick(new[] { 1, 1, 1, 2, 3 });
            // trải đều trong 14 ngày gần nhất (đơn mới nhất ~ hôm nay)
            var dayOffset = (int)Math.Round((double)(count - 1 - i) * 13 / Math.Max(1, count - 1));
            var createdAt = today.AddDays(-dayOffset).AddHours(Rint(8, 20));

            var pkgN = Rint(1, 4);
            var packages = new List<IngestPackage>();
            decimal wReal = 0, wCharged = 0; long canNang = 0;
            for (var k = 0; k < pkgN; k++)
            {
                var w = Math.Round((decimal)(rng.NextDouble() * 6 + 0.6), 2);
                var wc = Math.Round(w * (decimal)(1 + rng.NextDouble() * 0.12), 2);
                long unit = Pick(new[] { 13500L, 15000, 18000, 22000, 12000 });
                var total = (long)Math.Round(wc * unit);
                long extra = rng.NextDouble() < 0.2 ? Rint(1, 6) * 5000 : 0;
                wReal += w; wCharged += wc; canNang += total + extra;
                packages.Add(new IngestPackage
                {
                    Code = "7900" + Rint(100000000, 999999999),
                    Weight = w, WeightCharged = wc, UnitPrice = unit, Total = total, Extra = extra,
                    SellerShip = createdAt.AddDays(Rint(2, 4)).Date,
                    ToVN = createdAt.AddDays(Rint(5, 8)).Date,
                    InVN = createdAt.AddDays(Rint(12, 18)).Date,
                });
            }

            var tienHangCny = Math.Round(rng.NextDouble() * 600 + 80, 1);
            var tienHang = (long)Math.Round(tienHangCny * rate);
            var shipTQ = (long)Math.Round((rng.NextDouble() * 30 + 5) * rate);
            var phiMua = tienHang * buyPct / 100;
            var phiKiem = rng.NextDouble() < 0.15 ? Rint(1, 4) * 5000L : 0;
            var tongTienHang = tienHang + shipTQ + phiMua + phiKiem;
            var dongGo = rng.NextDouble() < 0.25 ? Rint(2, 8) * 10000L : 0;
            var luuKho = rng.NextDouble() < 0.10 ? Rint(1, 5) * 10000L : 0;
            var tong = tongTienHang + canNang + dongGo + luuKho;

            long daTT = status switch
            {
                "cho_coc" or "huy" => 0,
                "dang_mua" => (long)(tongTienHang * 0.8),
                "da_tra" or "thanh_ly" => tong,
                _ => (long)(tong * (0.7 + rng.NextDouble() * 0.25)),
            };

            var step = StepOf(status);
            var t = new IngestTimeline();
            var t0 = createdAt.AddDays(1);
            if (status is not ("cho_coc" or "huy")) t.DatCoc = t0;
            if (step >= 1 && status != "huy") t.DaMua = t0.AddDays(Rint(1, 3));
            if (step >= 2) t.VeVN = t0.AddDays(Rint(5, 9));
            if (step >= 3) t.KhoVN = t0.AddDays(Rint(14, 22));
            if (step >= 4) t.TraHang = t0.AddDays(Rint(24, 34));

            var history = new List<IngestHistory>();
            if (t.DatCoc is { } dc) history.Add(new IngestHistory { At = dc.AddHours(5), Text = $"Đặt cọc 80% tiền hàng, đơn chuyển sang trạng thái đang mua hàng." });
            if (t.DaMua is { } dm) history.Add(new IngestHistory { At = dm, Text = $"Đơn đã được nhân viên mua hàng đặt thành công." });
            if (t.KhoVN is { } kv) history.Add(new IngestHistory { At = kv, Text = "Toàn bộ kiện hàng đã về kho VN, sẵn sàng giao." });
            if (t.TraHang is { } th) history.Add(new IngestHistory { At = th, Text = "Đơn hàng đã giao cho khách. Hoàn tất." });

            var payments = new List<IngestPayment>();
            if (daTT > 0)
            {
                payments.Add(new IngestPayment { At = t.DatCoc ?? createdAt, Reason = "Đặt cọc 80% tiền hàng", Amount = -(long)(tongTienHang * 0.8) });
                if (status != "dang_mua")
                    payments.Add(new IngestPayment { At = t.VeVN ?? createdAt.AddDays(6), Reason = "Tất toán tiền mua hàng", Amount = -(tongTienHang - (long)(tongTienHang * 0.8)) });
            }

            var phone = "09" + Rint(10000000, 99999999);
            list.Add(new IngestOrderRequest
            {
                Id = 647900 + i,
                Status = status,
                PlatformKey = Pick(Platforms),
                ProductName = pname,
                Category = cat,
                CustomerName = $"{Pick(First)} {Pick(Mid)} {Pick(Last)}",
                CustomerPhone = phone[..4] + "***" + phone[^3..],
                Vip = Pick(Vips),
                Shipping = Pick(Shipping),
                Warehouse = Pick(Warehouses),
                BuyFeePct = buyPct,
                Rate = rate,
                WeightReal = Math.Round(wReal, 2),
                WeightCharged = Math.Round(wCharged, 2),
                Promo = rng.NextDouble() < 0.4 ? "Đơn 5 sao plus" : null,
                CreatedAt = new DateTimeOffset(createdAt, TimeSpan.Zero),
                Costs = new IngestCosts
                {
                    TienHang = tienHang, ShipTQ = shipTQ, PhiMuaHang = phiMua, PhiKiemDem = phiKiem,
                    TienCanNang = canNang, DongGo = dongGo, LuuKho = luuKho, DaThanhToan = daTT,
                },
                Timeline = t,
                Packages = packages,
                History = history,
                Payments = payments,
            });
        }
        return list;
    }

    private static int StepOf(string status) => status switch
    {
        "cho_coc" => 0,
        "dang_mua" => 1,
        "ve_vn" => 2,
        "kho_vn" => 3,
        "da_tra" => 4,
        "thanh_ly" => 4,
        "khieu_nai" => 3,
        _ => -1,
    };
}
