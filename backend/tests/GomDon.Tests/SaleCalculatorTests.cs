using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class SaleCalculatorTests
{
    [Fact]
    public void Computes_revenue_cogs_profit()
    {
        var items = new[]
        {
            new PricedSaleItem(1, 2, 274_000, 185_000, "ban"),
            new PricedSaleItem(2, 1, 119_000, 58_000, "ban"),
        };
        var costs = new[] { new CreateSaleCostRequest(null, "Ship", 22_000, "vnd") };
        var t = SaleCalculator.Compute(items, costs);
        Assert.Equal(667_000, t.Revenue);
        Assert.Equal(428_000, t.Cogs);
        Assert.Equal(0, t.PromoCost);
        Assert.Equal(22_000, t.ExtraCost);
        Assert.Equal(217_000, t.Profit);
    }

    [Fact]
    public void Gift_line_goes_to_promo_cost_not_cogs()
    {
        var items = new[]
        {
            new PricedSaleItem(1, 2, 274_000, 185_000, "ban"),
            new PricedSaleItem(2, 1, 119_000, 58_000, "ban"),
            new PricedSaleItem(3, 1, 0, 12_000, "tang"),   // tặng: vốn 12k
        };
        var costs = new[] { new CreateSaleCostRequest(null, "Ship", 28_000, "vnd") };
        var t = SaleCalculator.Compute(items, costs);
        Assert.Equal(667_000, t.Revenue);   // tặng góp 0 doanh thu
        Assert.Equal(428_000, t.Cogs);      // chỉ hàng bán
        Assert.Equal(12_000, t.PromoCost);  // vốn hàng tặng
        Assert.Equal(28_000, t.ExtraCost);
        Assert.Equal(199_000, t.Profit);    // 667 - 428 - 12 - 28
    }

    [Fact]
    public void Percent_cost_is_pct_of_revenue()
    {
        var items = new[] { new PricedSaleItem(1, 1, 100_000, 60_000, "ban") };
        var costs = new[] { new CreateSaleCostRequest(null, "Phí sàn", 10, "percent") };
        var t = SaleCalculator.Compute(items, costs);
        Assert.Equal(10_000, t.ExtraCost);
        Assert.Equal(30_000, t.Profit);
    }

    [Fact]
    public void No_costs_profit_is_revenue_minus_cogs()
    {
        var items = new[] { new PricedSaleItem(1, 1, 100_000, 60_000, "ban") };
        var t = SaleCalculator.Compute(items, System.Array.Empty<CreateSaleCostRequest>());
        Assert.Equal(40_000, t.Profit);
    }
}
