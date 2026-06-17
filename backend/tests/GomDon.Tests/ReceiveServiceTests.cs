using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Services;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Shared;
using Xunit;

namespace GomDon.Tests;

public class ReceiveServiceTests
{
    private sealed class FakeOrders : IOrderService
    {
        public OrderDetail? Detail;
        public Task<OrderDetail?> GetAsync(long id, CancellationToken ct = default) => Task.FromResult(Detail);
        public Task<PagedResult<OrderSummary>> ListAsync(OrderQuery q, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<long> IngestAsync(IngestOrderRequest r, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> ChangeStatusAsync(long id, string s, string? n, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class FakeReceiveRepo : IReceiveRepository
    {
        public Dictionary<string, long> ByLink = new();
        public ConfirmReceiveRequest? LastConfirm;
        public Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default)
            => Task.FromResult(ByLink.TryGetValue(linkCode, out var id) ? id : (long?)null);
        public Task<int> ConfirmAsync(ConfirmReceiveRequest req, CancellationToken ct = default)
        { LastConfirm = req; return Task.FromResult(req.Lines.Count); }
    }

    private static OrderDetail MakeOrder()
    {
        var d = new OrderDetail { Id = 700 };
        d.Costs = new CostsDto { TienHang = 400_000, ShipTQ = 30_000, DongGo = 10_000 }; // shared = 40k
        d.Links = new List<LinkDto>
        {
            new() { Idx = 1, LinkCode = "L-300", PriceVnd = 300_000, Qty = "3/3/3" },
            new() { Idx = 2, LinkCode = "L-100", PriceVnd = 100_000, Qty = "1/1/1" },
        };
        return d;
    }

    [Fact]
    public async Task Preview_allocates_and_parses_qty()
    {
        var orders = new FakeOrders { Detail = MakeOrder() };
        var repo = new FakeReceiveRepo();
        var svc = new ReceiveService(orders, repo);
        var p = await svc.PreviewAsync(700);

        Assert.Equal(40_000, p.SharedCost);
        var l1 = p.Lines.Single(x => x.LinkCode == "L-300");
        Assert.Equal(3, l1.Qty);             // parse "3/3/3"
        Assert.Equal(110_000, l1.UnitCost);  // (300k+30k)/3
        Assert.Null(l1.SuggestedProductId);  // chưa khớp
        Assert.False(string.IsNullOrEmpty(l1.SuggestedSku));
    }

    [Fact]
    public async Task Preview_suggests_existing_product_by_link()
    {
        var orders = new FakeOrders { Detail = MakeOrder() };
        var repo = new FakeReceiveRepo { ByLink = { ["L-300"] = 55 } };
        var svc = new ReceiveService(orders, repo);
        var p = await svc.PreviewAsync(700);
        Assert.Equal(55, p.Lines.Single(x => x.LinkCode == "L-300").SuggestedProductId);
    }

    [Fact]
    public async Task Preview_missing_order_throws()
    {
        var svc = new ReceiveService(new FakeOrders { Detail = null }, new FakeReceiveRepo());
        await Assert.ThrowsAsync<System.ComponentModel.DataAnnotations.ValidationException>(() => svc.PreviewAsync(999));
    }
}
