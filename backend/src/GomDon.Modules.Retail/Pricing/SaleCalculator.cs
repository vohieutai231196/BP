using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Pricing;

/// <summary>
/// Tổng đơn bán: revenue=Σ(qty×unit_price); cogs=Σ_ban(qty×unit_cost);
/// promo_cost=Σ_tang(qty×unit_cost); extra=Σ chi phí (percent theo % revenue);
/// profit = revenue − cogs − promo_cost − extra.
/// </summary>
public static class SaleCalculator
{
    public static SaleTotals Compute(IReadOnlyList<PricedSaleItem> items, IReadOnlyList<CreateSaleCostRequest> costs)
    {
        long revenue = items.Sum(i => (long)i.Qty * i.UnitPrice);
        long cogs = items.Where(i => i.LineType != "tang").Sum(i => (long)i.Qty * i.UnitCost);
        long promoCost = items.Where(i => i.LineType == "tang").Sum(i => (long)i.Qty * i.UnitCost);
        long extra = 0;
        foreach (var c in costs)
        {
            extra += c.Unit == "percent"
                ? (long)Math.Round(revenue * (decimal)c.Amount / 100m, MidpointRounding.AwayFromZero)
                : c.Amount;
        }
        long profit = revenue - cogs - promoCost - extra;
        return new SaleTotals(revenue, cogs, promoCost, extra, profit);
    }
}
