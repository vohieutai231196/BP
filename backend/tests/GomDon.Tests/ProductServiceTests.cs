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
        public readonly HashSet<long> Deleted = new();   // soft-deleted (deleted_at IS NOT NULL)
        private long _seq = 1;

        public Task<List<ProductListItem>> ListAsync(string? status, string? search, long? orderId = null, bool deleted = false, CancellationToken ct = default)
            => Task.FromResult(Db.Where(p => (deleted ? Deleted.Contains(p.Id) : !Deleted.Contains(p.Id)) && (status == null || p.Status == status))
                .Select(p => new ProductListItem(p.Id, p.Sku, p.Name, p.Category, p.ImageUrl, p.Status, p.AvgCost, p.ListPrice, p.CreatedAt, 0)).ToList());

        public Task<(RestoreOutcome Outcome, string? Sku)> RestoreAsync(long id, CancellationToken ct = default)
        {
            var p = Db.FirstOrDefault(x => x.Id == id);
            if (p is null) return Task.FromResult<(RestoreOutcome, string?)>((RestoreOutcome.NotFound, null));
            var conflict = Db.Any(x => x.Id != id && !Deleted.Contains(x.Id) && x.Sku.Equals(p.Sku, StringComparison.OrdinalIgnoreCase));
            if (conflict) return Task.FromResult<(RestoreOutcome, string?)>((RestoreOutcome.SkuConflict, p.Sku));
            Deleted.Remove(id);
            return Task.FromResult<(RestoreOutcome, string?)>((RestoreOutcome.Restored, p.Sku));
        }
        public Task<Product?> GetByIdAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.FirstOrDefault(p => p.Id == id && !Deleted.Contains(p.Id)));
        public Task<bool> SkuExistsAsync(string sku, CancellationToken ct = default)
            => Task.FromResult(Db.Any(p => !Deleted.Contains(p.Id) && p.Sku.Equals(sku, StringComparison.OrdinalIgnoreCase)));
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
        { Deleted.Add(id); return Task.CompletedTask; }
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.RemoveAll(x => x.Id == id) > 0);
        public Task<(long Stock, long AvgCost)> GetStockAndAvgAsync(long productId, CancellationToken ct = default)
        { var p = Db.First(x => x.Id == productId); return Task.FromResult(((long)0, p.AvgCost)); }
        public Task UpdateAvgCostAsync(long productId, long avgCost, CancellationToken ct = default)
        { Db.First(x => x.Id == productId).AvgCost = avgCost; return Task.CompletedTask; }

        public readonly Dictionary<long, IReadOnlyList<ProductCostTypeInput>> SetCostTypes = new();
        public (long ProductId, IReadOnlyList<ProductCostTypeInput> Items)? LastSet;
        public Task<List<ProductCostTypeDto>> GetCostTypesAsync(long productId, CancellationToken ct = default)
            => Task.FromResult(new List<ProductCostTypeDto>());
        public Task SetCostTypesAsync(long productId, IReadOnlyList<ProductCostTypeInput> items, CancellationToken ct = default)
        { SetCostTypes[productId] = items; LastSet = (productId, items); return Task.CompletedTask; }
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
    public async Task Create_with_cost_types_calls_set_cost_types()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var costTypes = new List<ProductCostTypeInput> { new(10, 5_000), new(20, null) };
        var item = await svc.CreateAsync(new CreateProductRequest("SKU-CT", "Giày", "shoe", null, 1, null, costTypes));
        Assert.NotNull(repo.LastSet);
        Assert.Equal(item.Id, repo.LastSet!.Value.ProductId);
        Assert.Equal(2, repo.LastSet.Value.Items.Count);
        Assert.True(repo.SetCostTypes.ContainsKey(item.Id));
    }

    [Fact]
    public async Task Create_without_cost_types_does_not_call_set()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        Assert.Null(repo.LastSet);
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
        Assert.False(removed);               // không xóa thật, chỉ soft-delete
        Assert.Single(repo.Db);              // row vẫn được giữ cho FK/báo cáo
        Assert.Contains(created.Id, repo.Deleted);
        Assert.Empty(await svc.ListAsync(null, null));   // biến mất khỏi mọi danh sách
    }

    [Fact]
    public async Task Can_recreate_same_sku_after_soft_delete()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var created = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        repo.SalesHistory.Add(created.Id);
        await svc.DeleteAsync(created.Id);                // soft-delete → giải phóng SKU
        var again = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày mới", "shoe", null, 1, null));
        Assert.NotEqual(created.Id, again.Id);            // là sản phẩm mới, không "dồn" vào cái cũ
        Assert.Single(await svc.ListAsync(null, null));   // danh sách chỉ thấy sản phẩm mới
    }

    [Fact]
    public async Task DeleteMany_mixes_delete_hide_and_block()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var a = await svc.CreateAsync(new CreateProductRequest("A", "Giày", "shoe", null, 1, null)); // xóa hẳn
        var b = await svc.CreateAsync(new CreateProductRequest("B", "Túi", "bag", null, 1, null));   // ẩn (đã bán)
        var c = await svc.CreateAsync(new CreateProductRequest("C", "Áo", "apparel", null, 1, null)); // bị chặn (đang dùng)
        repo.SalesHistory.Add(b.Id);
        repo.InUse.Add(c.Id);

        var r = await svc.DeleteManyAsync(new[] { a.Id, b.Id, c.Id, 999L });

        Assert.Equal(1, r.Deleted);
        Assert.Equal(1, r.Hidden);
        Assert.Single(r.Blocked);
        Assert.Equal(c.Id, r.Blocked[0].Id);
        Assert.Equal("C", r.Blocked[0].Sku);
        Assert.DoesNotContain(repo.Db, p => p.Id == a.Id);     // a đã xóa hẳn
        Assert.Contains(b.Id, repo.Deleted);                   // b soft-deleted
        Assert.Contains(repo.Db, p => p.Id == c.Id);           // c giữ nguyên
    }

    [Fact]
    public async Task DeleteMany_dedupes_and_ignores_unknown_ids()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var a = await svc.CreateAsync(new CreateProductRequest("A", "Giày", "shoe", null, 1, null));
        var r = await svc.DeleteManyAsync(new[] { a.Id, a.Id, 12345L });
        Assert.Equal(1, r.Deleted);          // không xóa 2 lần dù id lặp
        Assert.Empty(r.Blocked);
    }

    [Fact]
    public async Task Restore_brings_back_soft_deleted_product()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var p = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        repo.SalesHistory.Add(p.Id);
        await svc.DeleteAsync(p.Id);                        // soft-delete
        Assert.Empty(await svc.ListAsync(null, null));      // ẩn khỏi danh sách
        await svc.RestoreAsync(p.Id);
        Assert.DoesNotContain(p.Id, repo.Deleted);
        Assert.Single(await svc.ListAsync(null, null));     // hiện lại
    }

    [Fact]
    public async Task Restore_blocked_when_sku_reused()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var a = await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày", "shoe", null, 1, null));
        repo.SalesHistory.Add(a.Id);
        await svc.DeleteAsync(a.Id);                        // soft-delete A
        await svc.CreateAsync(new CreateProductRequest("SKU-1", "Giày mới", "shoe", null, 1, null)); // B dùng lại SKU
        await Assert.ThrowsAsync<ValidationException>(() => svc.RestoreAsync(a.Id));
        Assert.Contains(a.Id, repo.Deleted);               // A vẫn bị ẩn
    }

    [Fact]
    public async Task Restore_missing_id_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await Assert.ThrowsAsync<ValidationException>(() => svc.RestoreAsync(999));
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
