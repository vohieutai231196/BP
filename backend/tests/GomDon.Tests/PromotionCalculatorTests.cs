using GomDon.Modules.Retail.Pricing;
using Xunit;

namespace GomDon.Tests;

public class PromotionCalculatorTests
{
    [Fact]
    public void Percent_reduces_list_price()
        => Assert.Equal(85_000, PromotionCalculator.EffectivePrice(100_000, "percent", 15));

    [Fact]
    public void Fixed_is_absolute_price()
        => Assert.Equal(69_000, PromotionCalculator.EffectivePrice(100_000, "fixed", 69_000));

    [Fact]
    public void Percent_rounds_and_never_negative()
    {
        Assert.Equal(0, PromotionCalculator.EffectivePrice(100_000, "percent", 150)); // >100% → 0
        Assert.Equal(66_667, PromotionCalculator.EffectivePrice(100_000, "percent", 33.333));
    }
}
