namespace GomDon.Modules.Retail.Pricing;

/// <summary>Tính giá sau khuyến mãi. percent: list×(1−pct/100); fixed: chính là giá cố định.</summary>
public static class PromotionCalculator
{
    public static long EffectivePrice(long listPrice, string type, double value)
    {
        if (type == "fixed") return Math.Max(0, (long)value);
        var price = (long)Math.Round(listPrice * (1 - value / 100.0), MidpointRounding.AwayFromZero);
        return Math.Max(0, price);
    }
}
