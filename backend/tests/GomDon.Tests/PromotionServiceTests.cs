using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Xunit;

namespace GomDon.Tests;

public class PromotionServiceTests
{
    private sealed class FakeRepo : IPromotionRepository
    {
        public List<(long ProductId, long ListPrice, long PromotionId, string Name, string Type, long Value)> Active = new();
        public Task<List<PromotionListItem>> ListAsync(CancellationToken ct = default) => Task.FromResult(new List<PromotionListItem>());
        public Task<Promotion?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult<Promotion?>(new Promotion { Id = id });
        public Task<List<long>> GetProductIdsAsync(long promotionId, CancellationToken ct = default) => Task.FromResult(new List<long>());
        public Task<long> InsertAsync(string n, string t, long v, DateTime? s, DateTime? e, IReadOnlyList<long> ids, CancellationToken ct = default) => Task.FromResult(1L);
        public Task UpdateAsync(long id, string n, string t, long v, DateTime? s, DateTime? e, bool a, IReadOnlyList<long> ids, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => Task.FromResult(true);
        public Task<List<(long, long, long, string, string, long)>> GetActiveRawAsync(DateTime now, CancellationToken ct = default)
            => Task.FromResult(Active.Select(a => (a.ProductId, a.ListPrice, a.PromotionId, a.Name, a.Type, a.Value)).ToList());
    }

    private static PromotionService Make(FakeRepo r) => new(r, new CreatePromotionRequestValidator());

    [Fact]
    public async Task GetActive_picks_lowest_price_per_product()
    {
        var repo = new FakeRepo
        {
            Active =
            {
                (1, 100_000, 10, "KM 10%", "percent", 10),  // → 90k
                (1, 100_000, 11, "KM 30%", "percent", 30),  // → 70k (thắng)
                (2, 100_000, 12, "Giá sốc", "fixed", 50_000),
            }
        };
        var svc = Make(repo);
        var res = await svc.GetActiveAsync(new DateTime(2026, 6, 17));
        var p1 = res.Single(x => x.ProductId == 1);
        Assert.Equal(70_000, p1.Price);
        Assert.Equal(11, p1.PromotionId);
        Assert.Equal(50_000, res.Single(x => x.ProductId == 2).Price);
    }

    [Fact]
    public async Task Create_invalid_type_throws()
    {
        var svc = Make(new FakeRepo());
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            svc.CreateAsync(new CreatePromotionRequest("X", "weird", 1, null, null, null)));
    }
}
