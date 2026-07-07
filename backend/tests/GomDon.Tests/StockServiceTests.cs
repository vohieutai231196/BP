using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Shared;
using Xunit;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Tests;

public class StockServiceTests
{
    private sealed class FakeRepo : IStockRepository
    {
        public long Stock = 10;
        public (long pid, long actual, string reason)? LastAdjust;
        public Task<long> GetStockAsync(long productId, CancellationToken ct = default) => Task.FromResult(Stock);
        public Task InsertMovementAsync(long productId, string type, int qty, long unitCost,
            string? refType, long? refId, string? note, CancellationToken ct = default) => Task.CompletedTask;
        public Task<PagedResult<StockMovementItem>> ListMovementsAsync(long productId, int page, int pageSize, CancellationToken ct = default)
            => Task.FromResult(new PagedResult<StockMovementItem>());
        public Task<StockAdjustResult> AdjustAsync(long productId, long actualQty, string reason, CancellationToken ct = default)
        {
            LastAdjust = (productId, actualQty, reason);
            return Task.FromResult(new StockAdjustResult(productId, Stock, actualQty, actualQty - Stock));
        }
    }

    [Fact]
    public async Task Adjust_negative_actual_throws()
    {
        var svc = new StockService(new FakeRepo());
        await Assert.ThrowsAsync<ValidationException>(
            () => svc.AdjustAsync(new AdjustStockRequest(1, -3, "kiểm kê")));
    }

    [Fact]
    public async Task Adjust_default_reason_when_blank()
    {
        var repo = new FakeRepo();
        var svc = new StockService(repo);
        await svc.AdjustAsync(new AdjustStockRequest(1, 8, "  "));
        Assert.Equal("Điều chỉnh tồn", repo.LastAdjust!.Value.reason);
    }

    [Fact]
    public async Task Adjust_passes_through()
    {
        var repo = new FakeRepo();
        var svc = new StockService(repo);
        var r = await svc.AdjustAsync(new AdjustStockRequest(4, 6, "Hỏng"));
        Assert.Equal((-4), r.Delta);   // 6 - 10
        Assert.Equal((4L, 6L, "Hỏng"), repo.LastAdjust);
    }
}
