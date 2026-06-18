using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Xunit;

namespace GomDon.Tests;

public class ProductServiceTests
{
    private sealed class FakeRepo : IProductRepository
    {
        public readonly List<Product> Db = new();
        public readonly HashSet<long> InUse = new();
        public readonly HashSet<long> SalesHistory = new();
        private long _seq = 1;

        public Task<List<ProductListItem>> ListAsync(string? status, string? search, CancellationToken ct = default)
            => Task.FromResult(Db.Where(p => status == null || p.Status == status)
                .Select(p => new ProductListItem(p.Id, p.Sku, p.Name, p.Category, p.ImageUrl, p.Status, p.AvgCost, p.ListPrice, p.CreatedAt, 0)).ToList());
        public Task<Product?> GetByIdAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.FirstOrDefault(p => p.Id == id));
        public Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default)
            => Task.FromResult(Db.Any(p => p.Sku.Equals(sku, StringComparison.OrdinalIgnoreCase)));
        public Task<long> InsertAsync(CreateProductRequest req, CancellationToken ct = default)
        {
            var p = new Product { Id = _seq++, Sku = req.Sku, Name = req.Name,
                Category = string.IsNullOrWhiteSpace(req.Category) ? "other" : req.Category!,
                ImageUrl = req.ImageUrl, AvgCost = req.AvgCost, ListPrice = req.ListPrice, Status = "active" };
            Db.Add(p); return Task.FromResult(p.Id);
        }
        public Task<bool> UpdateAsync(long id, string name, string category, string? imageUrl, long avgCost, long? listPrice, string status, CancellationToken ct = default)
        { var p = Db.First(x => x.Id == id); p.Name = name; p.Category = category; p.ImageUrl = imageUrl; p.AvgCost = avgCost; p.ListPrice = listPrice; p.Status = status; return Task.FromResult(true); }
        public Task<bool> IsInUseAsync(long id, CancellationToken ct = default)
            => Task.FromResult(InUse.Contains(id));
        public Task<bool> HasSalesHistoryAsync(long id, CancellationToken ct = default)
            => Task.FromResult(SalesHistory.Contains(id));
        public Task SoftDeleteAsync(long id, CancellationToken ct = default)
        { var p = Db.First(x => x.Id == id); p.Status = "hidden"; return Task.CompletedTask; }
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.RemoveAll(x => x.Id == id) > 0);
        public Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default)
        { var p = Db.First(x => x.Id == productId); return Task.FromResult(((long)0, p.AvgCost)); }
        public Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default)
        { Db.First(x => x.Id == productId).AvgCost = avgCost; return Task.CompletedTask; }
    }

    private static ProductService Make(FakeRepo repo) => new(repo, new CreateProductRequestValidator());

    [Fact]
    public async Task Create_adds_product()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var item = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 185_000, 274_000));
        Assert.Equal("SKU-1", item.Sku);
        Assert.Single(repo.Db);
    }

    [Fact]
    public async Task Create_duplicate_sku_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.CreateAsync(new CreateProductRequest("sku-1", "Khác", "bag", null, 1, null)));
    }

    [Fact]
    public async Task Create_empty_sku_throws_validation()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            svc.CreateAsync(new CreateProductRequest("", "X", null, null, 0, null)));
    }

    [Fact]
    public async Task Update_missing_product_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.UpdateAsync(99, new UpdateProductRequest("X", null, null, null, null, null)));
    }

    [Fact]
    public async Task Delete_never_sold_product_removes_it()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var created = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        var removed = await svc.DeleteAsync(created.Id);
        Assert.True(removed);
        Assert.Empty(repo.Db);
    }

    [Fact]
    public async Task Delete_in_use_product_throws_and_keeps_it()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var created = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        repo.InUse.Add(created.Id);          // còn đơn chưa trả / trong combo
        await Assert.ThrowsAsync<ValidationException>(() => svc.DeleteAsync(created.Id));
        Assert.Single(repo.Db);
        Assert.Equal("active", repo.Db[0].Status);
    }

    [Fact]
    public async Task Delete_returned_only_product_is_soft_deleted()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var created = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        repo.SalesHistory.Add(created.Id);   // chỉ còn đơn đã trả
        var removed = await svc.DeleteAsync(created.Id);
        Assert.False(removed);               // không xóa thật, chỉ ẩn
        Assert.Single(repo.Db);
        Assert.Equal("hidden", repo.Db[0].Status);
    }

    [Fact]
    public async Task Update_partial_keeps_existing_fields()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var created = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 185_000, 274_000));
        await svc.UpdateAsync(created.Id, new UpdateProductRequest(null, null, null, 200_000, null, null));
        var p = repo.Db.Single();
        Assert.Equal("Giày", p.Name);        // giữ nguyên
        Assert.Equal(200_000, p.AvgCost);    // đã đổi
        Assert.Equal(274_000, p.ListPrice);  // giữ nguyên
    }
}
