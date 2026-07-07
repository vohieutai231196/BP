using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class StockMathTests
{
    [Fact]
    public void Empty_stock_returns_unit_cost()
        => Assert.Equal(50_000, StockMath.WeightedAvg(stock: 0, avg: 0, qty: 3, unitCost: 50_000));

    [Fact]
    public void Weighted_average_correct()
        // (10*100k + 5*40k) / 15 = 80k
        => Assert.Equal(80_000, StockMath.WeightedAvg(stock: 10, avg: 100_000, qty: 5, unitCost: 40_000));

    [Fact]
    public void Rounds_away_from_zero()
        // (1*100 + 1*101) / 2 = 100.5 → 101
        => Assert.Equal(101, StockMath.WeightedAvg(stock: 1, avg: 100, qty: 1, unitCost: 101));

    [Fact]
    public void Negative_legacy_stock_treated_as_zero()
        // tồn âm dữ liệu cũ → coi như 0, avg mới = unitCost
        => Assert.Equal(70_000, StockMath.WeightedAvg(stock: -4, avg: 99_000, qty: 2, unitCost: 70_000));
}
