using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class ComboAllocatorTests
{
    [Fact]
    public void Allocates_price_by_listprice_weight()
    {
        var comps = new[]
        {
            new ComboComponent(1, 1, "ban", 100_000, 60_000, 50),
            new ComboComponent(2, 1, "ban", 50_000, 30_000, 50),
        };
        // combo price 150k × 2 combo = 300k; tỷ lệ 100k:50k → 200k:100k
        var res = ComboAllocator.Expand(comps, comboPrice: 150_000, comboQty: 2).ToList();
        var a = res.Single(x => x.ProductId == 1);
        var b = res.Single(x => x.ProductId == 2);
        Assert.Equal(2, a.Qty);                 // 1×2
        Assert.Equal(100_000, a.UnitPrice);     // 200k / 2
        Assert.Equal(60_000, a.UnitCost);
        Assert.Equal("ban", a.LineType);
        Assert.Equal(50_000, b.UnitPrice);      // 100k / 2
    }

    [Fact]
    public void Gift_component_priced_zero_and_keeps_line_type()
    {
        var comps = new[]
        {
            new ComboComponent(1, 1, "ban", 100_000, 60_000, 10),
            new ComboComponent(3, 1, "tang", 12_000, 12_000, 10),
        };
        var res = ComboAllocator.Expand(comps, comboPrice: 120_000, comboQty: 1).ToList();
        Assert.Equal(120_000, res.Single(x => x.ProductId == 1).UnitPrice); // toàn bộ doanh thu vào hàng bán
        var gift = res.Single(x => x.ProductId == 3);
        Assert.Equal(0, gift.UnitPrice);
        Assert.Equal("tang", gift.LineType);
        Assert.Equal(12_000, gift.UnitCost);
    }

    [Fact]
    public void Zero_listprice_splits_equally_by_qty()
    {
        var comps = new[]
        {
            new ComboComponent(1, 1, "ban", 0, 10_000, 10),
            new ComboComponent(2, 1, "ban", 0, 10_000, 10),
        };
        var res = ComboAllocator.Expand(comps, comboPrice: 100_000, comboQty: 1).ToList();
        Assert.Equal(50_000, res.Single(x => x.ProductId == 1).UnitPrice);
        Assert.Equal(50_000, res.Single(x => x.ProductId == 2).UnitPrice);
    }
}
