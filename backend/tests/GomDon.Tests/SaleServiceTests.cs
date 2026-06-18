using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Xunit;

namespace GomDon.Tests;

public class SaleServiceTests
{
    private sealed class FakeProducts : IProductRepository
    {
        public readonly List<Product> Db = new();
        public Task<List<ProductListItem>> ListAsync(string? s, string? q, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Product?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult(Db.FirstOrDefault(p => p.Id == id));
        public Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<long> InsertAsync(CreateProductRequest req, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> UpdateAsync(long id, string n, string c, string? img, long avg, long? lp, string st, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default)
        { var p = Db.First(x => x.Id == productId); return Task.FromResult(((long)0, p.AvgCost)); }
        public Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeSales : ISaleRepository
    {
        public CreateSaleRequest? Req; public SaleTotals? Totals; public List<PricedSaleItem>? Priced;
        public Task<List<SaleListItem>> ListAsync(CancellationToken ct = default) => Task.FromResult(new List<SaleListItem>());
        public Task<long> CreateAsync(CreateSaleRequest req, string code, IReadOnlyList<PricedSaleItem> priced, SaleTotals totals,
            IReadOnlyList<(long? CostTypeId, string Name, long Amount)> costRows, CancellationToken ct = default)
        { Req = req; Totals = totals; Priced = priced.ToList(); return Task.FromResult(1L); }
        public bool Returned; public long ReturnedId;
        public Task<bool> ReturnAsync(long saleId, CancellationToken ct = default)
        { Returned = true; ReturnedId = saleId; return Task.FromResult(true); }
    }

    private sealed class FakeCombosForSale : IComboRepository
    {
        public Combo? Combo; public List<ComboComponent> Components = new();
        public Task<List<ComboListItem>> ListAsync(CancellationToken ct = default) => Task.FromResult(new List<ComboListItem>());
        public Task<Combo?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult(Combo);
        public Task<List<ComboComponent>> GetComponentsAsync(long comboId, CancellationToken ct = default) => Task.FromResult(Components);
        public Task<long> InsertAsync(CreateComboRequest req, CancellationToken ct = default) => Task.FromResult(1L);
        public Task UpdateAsync(long id, string n, string? img, long p, bool a, IReadOnlyList<CreateComboItemRequest>? items, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => Task.FromResult(true);
    }

    private static (SaleService svc, FakeProducts prods, FakeSales sales, FakeCombosForSale combos) Make()
    {
        var prods = new FakeProducts(); var sales = new FakeSales(); var combos = new FakeCombosForSale();
        return (new SaleService(sales, prods, combos, new CreateSaleRequestValidator()), prods, sales, combos);
    }

    [Fact]
    public async Task Create_prices_items_with_avg_cost_and_totals()
    {
        var (svc, prods, sales, _) = Make();
        prods.Db.Add(new Product { Id = 1, AvgCost = 185_000 });
        var req = new CreateSaleRequest { Items = { new CreateSaleItemRequest(1, 2, 274_000) } };
        await svc.CreateAsync(req);
        Assert.Equal(185_000, sales.Priced!.Single().UnitCost);
        Assert.Equal(548_000, sales.Totals!.Revenue);
        Assert.Equal(370_000, sales.Totals!.Cogs);
        Assert.Equal(178_000, sales.Totals!.Profit);
    }

    [Fact]
    public async Task Gift_item_priced_zero_and_goes_to_promo_cost()
    {
        var (svc, prods, sales, _) = Make();
        prods.Db.Add(new Product { Id = 1, AvgCost = 185_000 });
        prods.Db.Add(new Product { Id = 2, AvgCost = 12_000 });
        var req = new CreateSaleRequest
        {
            Items =
            {
                new CreateSaleItemRequest(1, 1, 274_000, "ban"),
                new CreateSaleItemRequest(2, 1, 999, "tang"),  // giá gửi lên bị ép về 0
            }
        };
        await svc.CreateAsync(req);
        var gift = sales.Priced!.Single(x => x.LineType == "tang");
        Assert.Equal(0, gift.UnitPrice);
        Assert.Equal(12_000, gift.UnitCost);
        Assert.Equal(12_000, sales.Totals!.PromoCost);
        Assert.Equal(185_000, sales.Totals!.Cogs);
        Assert.Equal(274_000, sales.Totals!.Revenue);
    }

    [Fact]
    public async Task Create_empty_sale_throws()
    {
        var (svc, _, _, _) = Make();
        await Assert.ThrowsAsync<System.ComponentModel.DataAnnotations.ValidationException>(() => svc.CreateAsync(new CreateSaleRequest()));
    }

    [Fact]
    public async Task Create_unknown_product_throws()
    {
        var (svc, _, _, _) = Make();
        var req = new CreateSaleRequest { Items = { new CreateSaleItemRequest(99, 1, 1000) } };
        await Assert.ThrowsAsync<System.ComponentModel.DataAnnotations.ValidationException>(() => svc.CreateAsync(req));
    }

    [Fact]
    public async Task Sell_combo_expands_components()
    {
        var (svc, prods, sales, combos) = Make();
        prods.Db.Add(new Product { Id = 1, AvgCost = 60_000 });
        prods.Db.Add(new Product { Id = 2, AvgCost = 30_000 });
        combos.Combo = new Combo { Id = 9, Price = 150_000 };
        combos.Components = new()
        {
            new ComboComponent(1, 1, "ban", 100_000, 60_000, 50),
            new ComboComponent(2, 1, "ban", 50_000, 30_000, 50),
        };
        var req = new CreateSaleRequest { Combos = { new CreateSaleComboLine(9, 1) } };
        await svc.CreateAsync(req);
        Assert.Equal(2, sales.Priced!.Count);
        Assert.Equal(150_000, sales.Totals!.Revenue);   // 100k + 50k
        Assert.Equal(90_000, sales.Totals!.Cogs);       // 60k + 30k
        Assert.Equal(60_000, sales.Totals!.Profit);
    }

    [Fact]
    public async Task Loose_item_carries_promo_id()
    {
        var (svc, prods, sales, _) = Make();
        prods.Db.Add(new Product { Id = 1, AvgCost = 60_000 });
        var req = new CreateSaleRequest { Items = { new CreateSaleItemRequest(1, 1, 90_000, "ban", 5) } };
        await svc.CreateAsync(req);
        Assert.Equal(5, sales.Priced!.Single().PromoId);
    }

    [Fact]
    public async Task Return_calls_repo()
    {
        var (svc, _, sales, _) = Make();
        await svc.ReturnAsync(5);
        Assert.True(sales.Returned);
        Assert.Equal(5, sales.ReturnedId);
    }
}
