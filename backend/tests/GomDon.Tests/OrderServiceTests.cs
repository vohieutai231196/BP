using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Repositories;
using GomDon.Modules.Orders.Services;
using GomDon.Modules.Orders.Validators;
using GomDon.Shared;
using Xunit;

namespace GomDon.Tests;

public class OrderServiceTests
{
    // ---- fake repository ghi lại lời gọi ----
    private sealed class FakeRepo : IOrderRepository
    {
        public IngestOrderRequest? Ingested;
        public (long id, string status, string text)? StatusCall;
        public bool UpdateReturns = true;

        public Task<long> IngestAsync(IngestOrderRequest req, CancellationToken ct = default)
        { Ingested = req; return Task.FromResult(648001L); }

        public Task<bool> UpdateStatusAsync(long id, string status, string historyText, CancellationToken ct = default)
        { StatusCall = (id, status, historyText); return Task.FromResult(UpdateReturns); }

        public Task<PagedResult<OrderSummary>> ListAsync(OrderQuery q, CancellationToken ct = default) => Task.FromResult(new PagedResult<OrderSummary>());
        public Task<OrderDetail?> GetByIdAsync(long id, CancellationToken ct = default) => Task.FromResult<OrderDetail?>(null);
        public Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default) => Task.FromResult(new DashboardSummary());
        public Task<int> CountAsync(CancellationToken ct = default) => Task.FromResult(0);
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => Task.FromResult(true);
    }

    private sealed class NoopTranslation : ITranslationService
    {
        public Task<IReadOnlyDictionary<string, string>> TranslateAsync(IEnumerable<string> terms, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyDictionary<string, string>>(new Dictionary<string, string>());
    }

    private static (OrderService svc, FakeRepo repo) Make()
    {
        var repo = new FakeRepo();
        return (new OrderService(repo, new IngestOrderRequestValidator(), new NoopTranslation()), repo);
    }

    [Fact]
    public async Task Ingest_valid_calls_repo_and_returns_id()
    {
        var (svc, repo) = Make();
        var id = await svc.IngestAsync(new IngestOrderRequest { ProductName = "P", CustomerName = "C", Rate = 4035 });
        Assert.Equal(648001L, id);
        Assert.NotNull(repo.Ingested);
    }

    [Fact]
    public async Task Ingest_invalid_throws_and_does_not_touch_repo()
    {
        var (svc, repo) = Make();
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(
            () => svc.IngestAsync(new IngestOrderRequest { ProductName = "", CustomerName = "", Rate = 0 }));
        Assert.Null(repo.Ingested);
    }

    [Fact]
    public async Task ChangeStatus_valid_writes_history_with_label()
    {
        var (svc, repo) = Make();
        var ok = await svc.ChangeStatusAsync(647900, "kho_vn", "ghi chú X");
        Assert.True(ok);
        Assert.Equal("kho_vn", repo.StatusCall!.Value.status);
        Assert.Contains("Trong kho VN", repo.StatusCall.Value.text);   // label tiếng Việt
        Assert.Contains("ghi chú X", repo.StatusCall.Value.text);
    }

    [Fact]
    public async Task ChangeStatus_invalid_status_throws_and_does_not_touch_repo()
    {
        var (svc, repo) = Make();
        await Assert.ThrowsAsync<ValidationException>(() => svc.ChangeStatusAsync(1, "xyz", null));
        Assert.Null(repo.StatusCall);
    }

    [Fact]
    public async Task ChangeStatus_returns_false_when_order_missing()
    {
        var (svc, repo) = Make();
        repo.UpdateReturns = false;
        Assert.False(await svc.ChangeStatusAsync(999, "da_tra", null));
    }
}
