using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Pricing;

/// <summary>
/// Giãn 1 dòng combo thành các PricedSaleItem thành phần.
/// Doanh thu (price×comboQty) phân bổ cho các thành phần 'ban' theo tỷ lệ list_price×qty;
/// 'tang' → unit_price 0. Tổng list_price×qty = 0 → chia đều theo qty.
/// </summary>
public static class ComboAllocator
{
    public static IEnumerable<PricedSaleItem> Expand(IReadOnlyList<ComboComponent> components, long comboPrice, int comboQty)
    {
        if (comboQty <= 0) comboQty = 1;
        long totalRevenue = comboPrice * comboQty;

        var ban = components.Where(c => c.LineType != "tang").ToList();
        long weightSum = ban.Sum(c => c.ListPrice * c.Qty);
        long qtySum = ban.Sum(c => (long)c.Qty);

        var result = new List<PricedSaleItem>();
        foreach (var c in components)
        {
            int lineQty = c.Qty * comboQty;
            long unitPrice = 0;
            if (c.LineType != "tang" && lineQty > 0)
            {
                long lineTotal;
                if (weightSum > 0)
                    lineTotal = (long)Math.Round(totalRevenue * (decimal)(c.ListPrice * c.Qty) / weightSum, MidpointRounding.AwayFromZero);
                else if (qtySum > 0)
                    lineTotal = (long)Math.Round(totalRevenue * (decimal)c.Qty / qtySum, MidpointRounding.AwayFromZero);
                else
                    lineTotal = 0;
                unitPrice = (long)Math.Round(lineTotal / (decimal)lineQty, MidpointRounding.AwayFromZero);
            }
            result.Add(new PricedSaleItem(c.ProductId, lineQty, unitPrice, c.AvgCost, c.LineType == "tang" ? "tang" : "ban"));
        }
        return result;
    }
}
