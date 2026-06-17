using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Pricing;

/// <summary>
/// Máy tính giá bán/lợi nhuận. Logic thuần (không I/O) để dễ test.
///  cost_base = unit_cost + extra_cost
///  markup : price = cost_base × (1 + pct/100)
///  margin : price = cost_base ÷ (1 − pct/100); pct=100 => không xác định
/// Chi phí 'percent' tính theo % của unit_cost (tránh phụ thuộc vòng với giá bán).
/// </summary>
public static class PricingCalculator
{
    private static readonly int[] DefaultLevels = { 10, 20, 30, 50, 70, 100 };

    public static PricingResult Compute(PricingRequest req)
    {
        var unitCost = Math.Max(0, req.UnitCost);
        long extra = 0;
        foreach (var c in req.Costs)
        {
            extra += c.Unit == "percent"
                ? (long)Math.Round(unitCost * (decimal)c.Amount / 100m, MidpointRounding.AwayFromZero)
                : c.Amount;
        }
        var costBase = unitCost + extra;

        var levels = (req.Levels is { Count: > 0 } ? req.Levels : DefaultLevels.ToList())
            .Select(pct => BuildLevel(costBase, pct, req.RoundTo))
            .ToList();

        return new PricingResult(unitCost, extra, costBase, levels);
    }

    private static PricingLevel BuildLevel(long costBase, int pct, int roundTo)
    {
        var priceMarkup = RoundPretty((long)Math.Round(costBase * (1 + pct / 100m), MidpointRounding.AwayFromZero), roundTo);
        long profitMarkup = priceMarkup - costBase;

        long? priceMargin = null, profitMargin = null;
        if (pct < 100)
        {
            var raw = (long)Math.Round(costBase / (1 - pct / 100m), MidpointRounding.AwayFromZero);
            priceMargin = RoundPretty(raw, roundTo);
            profitMargin = priceMargin - costBase;
        }
        return new PricingLevel(pct, priceMarkup, profitMarkup, priceMargin, profitMargin);
    }

    /// <summary>Làm tròn LÊN bội số roundTo (0 = giữ nguyên).</summary>
    public static long RoundPretty(long value, int roundTo)
        => roundTo <= 0 ? value : (long)Math.Ceiling(value / (double)roundTo) * roundTo;

    /// <summary>Cảnh báo lỗ: giá bán dưới giá vốn nền.</summary>
    public static bool IsLoss(long costBase, long sellingPrice) => sellingPrice < costBase;
}
