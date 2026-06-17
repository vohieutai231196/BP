using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class LandedCostAllocatorTests
{
    [Fact]
    public void Allocates_shared_cost_by_price_ratio()
    {
        var lines = new[] { new AllocInput(1, 300_000, 3), new AllocInput(2, 100_000, 1) };
        var res = LandedCostAllocator.Allocate(lines, sharedCost: 40_000).ToList();
        // tỷ lệ 3:1 → link1 nhận 30k, link2 nhận 10k
        var a = res.Single(x => x.OrderLinkId == 1);
        var b = res.Single(x => x.OrderLinkId == 2);
        Assert.Equal(330_000, a.LandedTotal);
        Assert.Equal(110_000, b.LandedTotal);
        Assert.Equal(110_000, a.UnitCost); // 330000/3
        Assert.Equal(110_000, b.UnitCost); // 110000/1
    }

    [Fact]
    public void Zero_total_price_splits_equally()
    {
        var lines = new[] { new AllocInput(1, 0, 1), new AllocInput(2, 0, 1) };
        var res = LandedCostAllocator.Allocate(lines, sharedCost: 50_000).ToList();
        Assert.Equal(25_000, res.Single(x => x.OrderLinkId == 1).LandedTotal);
        Assert.Equal(25_000, res.Single(x => x.OrderLinkId == 2).LandedTotal);
    }

    [Fact]
    public void Qty_zero_treated_as_one_for_unit_cost()
    {
        var lines = new[] { new AllocInput(1, 100_000, 0) };
        var res = LandedCostAllocator.Allocate(lines, sharedCost: 0).ToList();
        Assert.Equal(100_000, res.Single().UnitCost);
    }

    [Fact]
    public void No_lines_returns_empty()
        => Assert.Empty(LandedCostAllocator.Allocate(System.Array.Empty<AllocInput>(), 10_000));
}
