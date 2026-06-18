using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Repositories;

public interface ISaleRepository
{
    Task<List<SaleListItem>> ListAsync(CancellationToken ct = default);
    /// <summary>Tạo đơn trong 1 transaction: chặn nếu tồn < qty; trừ tồn (movement out); lưu items/costs. Trả sale id.</summary>
    Task<long> CreateAsync(CreateSaleRequest req, string code, IReadOnlyList<PricedSaleItem> pricedItems, SaleTotals totals,
        IReadOnlyList<(long? CostTypeId, string Name, long Amount)> costRows, CancellationToken ct = default);
    Task<bool> ReturnAsync(long saleId, CancellationToken ct = default);
}
