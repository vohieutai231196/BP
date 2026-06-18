using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class SaleService : ISaleService
{
    private readonly ISaleRepository _sales;
    private readonly IProductRepository _products;
    private readonly IComboRepository _combos;
    private readonly IValidator<CreateSaleRequest> _validator;

    public SaleService(ISaleRepository sales, IProductRepository products, IComboRepository combos,
        IValidator<CreateSaleRequest> validator)
    {
        _sales = sales;
        _products = products;
        _combos = combos;
        _validator = validator;
    }

    public Task<List<SaleListItem>> ListAsync(CancellationToken ct = default) => _sales.ListAsync(ct);

    public async Task<long> CreateAsync(CreateSaleRequest req, CancellationToken ct = default)
    {
        await _validator.ValidateAndThrowAsync(req, ct);

        var priced = new List<PricedSaleItem>();

        // 1) item lẻ
        foreach (var i in req.Items)
        {
            var p = await _products.GetByIdAsync(i.ProductId, ct)
                ?? throw new ValidationException($"Không tìm thấy sản phẩm #{i.ProductId}.");
            var lineType = i.LineType == "tang" ? "tang" : "ban";
            var price = lineType == "tang" ? 0 : i.UnitPrice;
            priced.Add(new PricedSaleItem(p.Id, i.Qty, price, p.AvgCost, lineType, lineType == "tang" ? null : i.PromoId));
        }

        // 2) dòng combo → giãn thành phần
        foreach (var cl in req.Combos)
        {
            var combo = await _combos.GetByIdAsync(cl.ComboId, ct)
                ?? throw new ValidationException($"Không tìm thấy combo #{cl.ComboId}.");
            var comps = await _combos.GetComponentsAsync(cl.ComboId, ct);
            if (comps.Count == 0) throw new ValidationException($"Combo #{cl.ComboId} không có thành phần.");
            priced.AddRange(ComboAllocator.Expand(comps, combo.Price, cl.Qty <= 0 ? 1 : cl.Qty, combo.PromotionId));
        }

        if (priced.Count == 0) throw new ValidationException("Đơn bán không có sản phẩm.");

        var totals = SaleCalculator.Compute(priced, req.Costs);
        var costRows = req.Costs.Select(c =>
        {
            long amt = c.Unit == "percent"
                ? (long)Math.Round(totals.Revenue * (decimal)c.Amount / 100m, MidpointRounding.AwayFromZero)
                : c.Amount;
            return ((long?)c.CostTypeId, c.Name, amt);
        }).ToList();

        var code = NewCode();
        return await _sales.CreateAsync(req, code, priced, totals, costRows, ct);
    }

    private static string NewCode() => "BAN-" + DateTime.UtcNow.ToString("yyMMdd-HHmmss");
}
