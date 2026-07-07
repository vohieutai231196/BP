namespace GomDon.Modules.Retail.Pricing;

/// <summary>Toán tồn kho dùng chung cho mọi đường nhập (phiếu thủ công + nhận từ đơn mua hộ).</summary>
public static class StockMath
{
    /// <summary>Giá vốn bình quân gia quyền sau khi nhập thêm qty @ unitCost.</summary>
    public static long WeightedAvg(long stock, long avg, int qty, long unitCost)
    {
        if (stock < 0) stock = 0;                 // tồn âm (dữ liệu cũ) → coi như 0
        if (stock + qty <= 0) return unitCost;
        return (long)Math.Round(
            (stock * (decimal)avg + qty * (decimal)unitCost) / (stock + qty),
            MidpointRounding.AwayFromZero);
    }
}
