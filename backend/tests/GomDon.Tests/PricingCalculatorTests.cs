using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class PricingCalculatorTests
{
    private static PricingRequest Req(long unitCost, int roundTo = 0, params PricingCostLine[] costs)
        => new() { UnitCost = unitCost, RoundTo = roundTo, Costs = costs.ToList() };

    [Fact]
    public void CostBase_sums_unit_cost_and_vnd_costs()
    {
        var r = PricingCalculator.Compute(Req(185_000, 0,
            new PricingCostLine("Ship", 18_000, "vnd"),
            new PricingCostLine("Bao bì", 5_000, "vnd")));
        Assert.Equal(185_000, r.UnitCost);
        Assert.Equal(23_000, r.ExtraCost);
        Assert.Equal(208_000, r.CostBase);
    }

    [Fact]
    public void Percent_cost_is_pct_of_unit_cost()
    {
        var r = PricingCalculator.Compute(Req(100_000, 0,
            new PricingCostLine("Phí sàn", 10, "percent")));   // 10% của 100k = 10k
        Assert.Equal(10_000, r.ExtraCost);
        Assert.Equal(110_000, r.CostBase);
    }

    [Fact]
    public void Markup_30pct_adds_to_cost_base()
    {
        var r = PricingCalculator.Compute(Req(100_000)); // cost_base = 100k
        var l30 = r.LevelsResult.Single(x => x.Pct == 30);
        Assert.Equal(130_000, l30.PriceMarkup);
        Assert.Equal(30_000, l30.ProfitMarkup);
    }

    [Fact]
    public void Margin_30pct_divides_cost_base()
    {
        var r = PricingCalculator.Compute(Req(100_000)); // cost_base = 100k
        var l30 = r.LevelsResult.Single(x => x.Pct == 30);
        // 100000 / (1 - 0.30) = 142857.14 -> làm tròn 142857
        Assert.Equal(142_857, l30.PriceMargin);
        Assert.Equal(42_857, l30.ProfitMargin);
    }

    [Fact]
    public void Margin_at_100pct_is_null()
    {
        var r = PricingCalculator.Compute(Req(100_000));
        var l100 = r.LevelsResult.Single(x => x.Pct == 100);
        Assert.Null(l100.PriceMargin);
        Assert.Null(l100.ProfitMargin);
    }

    [Fact]
    public void Default_levels_are_10_20_30_50_70_100()
    {
        var r = PricingCalculator.Compute(Req(100_000));
        Assert.Equal(new[] { 10, 20, 30, 50, 70, 100 }, r.LevelsResult.Select(x => x.Pct).ToArray());
    }

    [Fact]
    public void RoundTo_1000_rounds_price_up()
    {
        var r = PricingCalculator.Compute(Req(100_000, 1000)); // margin 30% = 142857 -> 143000
        var l30 = r.LevelsResult.Single(x => x.Pct == 30);
        Assert.Equal(143_000, l30.PriceMargin);
        Assert.Equal(130_000, l30.PriceMarkup); // markup vốn 130k đã tròn
    }

    [Fact]
    public void IsLoss_true_when_price_below_cost_base()
    {
        Assert.True(PricingCalculator.IsLoss(208_000, 200_000));
        Assert.False(PricingCalculator.IsLoss(208_000, 208_000));
        Assert.False(PricingCalculator.IsLoss(208_000, 300_000));
    }
}
