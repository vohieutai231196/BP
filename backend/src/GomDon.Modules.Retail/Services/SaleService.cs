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
    private readonly IValidator<CreateSaleRequest> _validator;

    public SaleService(ISaleRepository sales, IProductRepository products, IValidator<CreateSaleRequest> validator)
    {
        _sales = sales;
        _products = products;
        _validator = validator;
    }

    public Task<List<SaleListItem>> ListAsync(CancellationToken ct = default) => _sales.ListAsync(ct);

    public async Task<long> CreateAsync(CreateSaleRequest req, CancellationToken ct = default)
    {
        await _validator.ValidateAndThrowAsync(req, ct);

        var priced = new List<PricedSaleItem>();
        foreach (var i in req.Items)
        {
            var p = await _products.GetByIdAsync(i.ProductId, ct)
                ?? throw new ValidationException($"Không tìm thấy sản phẩm #{i.ProductId}.");
            var lineType = i.LineType == "tang" ? "tang" : "ban";
            var price = lineType == "tang" ? 0 : i.UnitPrice;
            priced.Add(new PricedSaleItem(p.Id, i.Qty, price, p.AvgCost, lineType));
        }

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

    private static string NewCode()
        => "BAN-" + DateTime.UtcNow.ToString("yyMMdd-HHmmss");
}
