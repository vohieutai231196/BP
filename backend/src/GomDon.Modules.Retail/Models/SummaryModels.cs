namespace GomDon.Modules.Retail.Models;

public sealed record RetailSummary(
    int TotalSkus, long TotalStock, long StockValue, int LowStockCount,
    long TotalRevenue, long TotalProfit, int SalesCount);

public sealed record ImportBatch(
    long OrderId, DateTime ReceivedAt, int SkuCount, long TotalQty, long TotalCost);
