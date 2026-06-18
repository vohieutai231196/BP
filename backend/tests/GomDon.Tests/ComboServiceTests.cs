using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Xunit;

namespace GomDon.Tests;

public class ComboServiceTests
{
    private sealed class FakeProducts : IProductRepository
    {
        public readonly Dictionary<long, long> Stock = new(); // productId -> stock
        public Task<List<ProductListItem>> ListAsync(string? s, string? q, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<Product?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult<Product?>(new Product { Id = id });
        public Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<long> InsertAsync(CreateProductRequest req, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> UpdateAsync(long id, string n, string c, string? img, long avg, long? lp, string st, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> IsInUseAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> HasSalesHistoryAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task SoftDeleteAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default)
            => Task.FromResult((Stock.TryGetValue(productId, out var s) ? s : 0, 0L));
        public Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class FakeCombos : IComboRepository
    {
        public CreateComboRequest? Inserted;
        public Task<List<ComboListItem>> ListAsync(CancellationToken ct = default) => Task.FromResult(new List<ComboListItem>());
        public Task<Combo?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult<Combo?>(new Combo { Id = id });
        public Task<List<ComboComponent>> GetComponentsAsync(long comboId, CancellationToken ct = default) => Task.FromResult(new List<ComboComponent>());
        public Task<long> InsertAsync(CreateComboRequest req, CancellationToken ct = default) { Inserted = req; return Task.FromResult(1L); }
        public Task UpdateAsync(long id, string n, string? img, long p, bool a, IReadOnlyList<CreateComboItemRequest>? items, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => Task.FromResult(true);
    }

    private static ComboService Make(FakeCombos c, FakeProducts p) => new(c, p, new CreateComboRequestValidator());

    [Fact]
    public async Task Create_ok_when_all_components_in_stock()
    {
        var combos = new FakeCombos();
        var prods = new FakeProducts { Stock = { [1] = 5, [2] = 3 } };
        var svc = Make(combos, prods);
        var req = new CreateComboRequest("CB1", "Combo", null, 100_000, new()
        { new CreateComboItemRequest(1, 1, "ban"), new CreateComboItemRequest(2, 1, "ban") });
        await svc.CreateAsync(req);
        Assert.NotNull(combos.Inserted);
    }

    [Fact]
    public async Task Create_blocked_when_a_component_out_of_stock()
    {
        var combos = new FakeCombos();
        var prods = new FakeProducts { Stock = { [1] = 5, [2] = 0 } };
        var svc = Make(combos, prods);
        var req = new CreateComboRequest("CB1", "Combo", null, 100_000, new()
        { new CreateComboItemRequest(1, 1, "ban"), new CreateComboItemRequest(2, 1, "ban") });
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req));
        Assert.Null(combos.Inserted);
    }

    [Fact]
    public async Task Create_empty_items_throws_validation()
    {
        var svc = Make(new FakeCombos(), new FakeProducts());
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            svc.CreateAsync(new CreateComboRequest("CB", "X", null, 0, new())));
    }
}
