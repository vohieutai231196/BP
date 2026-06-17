using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Pricing;

/// <summary>
/// Phân bổ chi phí dùng chung của đơn về từng link theo tỷ lệ tiền hàng (price_vnd).
/// landed_line = price_vnd + share; unit_cost = round(landed / max(qty,1)).
/// Tổng price = 0 → chia đều.
/// </summary>
public static class LandedCostAllocator
{
    public static IEnumerable<AllocResult> Allocate(IReadOnlyList<AllocInput> lines, long sharedCost)
    {
        if (lines.Count == 0) return Enumerable.Empty<AllocResult>();
        long totalPrice = lines.Sum(l => l.PriceVnd);

        return lines.Select((l, i) =>
        {
            long share = totalPrice > 0
                ? (long)Math.Round(sharedCost * (decimal)l.PriceVnd / totalPrice, MidpointRounding.AwayFromZero)
                : (long)Math.Round(sharedCost / (decimal)lines.Count, MidpointRounding.AwayFromZero);
            long landed = l.PriceVnd + share;
            int q = l.Qty <= 0 ? 1 : l.Qty;
            long unit = (long)Math.Round(landed / (decimal)q, MidpointRounding.AwayFromZero);
            return new AllocResult(l.OrderLinkId, landed, unit);
        }).ToList();
    }
}
