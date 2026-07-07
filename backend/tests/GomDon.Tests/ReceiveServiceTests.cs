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
        public Task<long?> FindProductByLinkCodeAsync(string linkCode, CancellationToken ct = default)
            => Task.FromResult(ByLink.TryGetValue(linkCode, out var id) ? id : (long?)null);
    }

    private sealed class FakeReceiptRepo : IReceiptRepository
    {
        public CreateReceiptCommand? LastCmd;
        public Task<ReceiptCreated> CreateAsync(CreateReceiptCommand cmd, CancellationToken ct = default)
        { LastCmd = cmd; return Task.FromResult(new ReceiptCreated(9, "PN-260707-9", cmd.Lines.Count)); }
        public Task<GomDon.Shared.PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default)
            => Task.FromResult(new GomDon.Shared.PagedResult<ReceiptListItem>());
        public Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default)
            => Task.FromResult<ReceiptDetail?>(null);
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
        var svc = new ReceiveService(orders, repo, new FakeReceiptRepo());
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
        var svc = new ReceiveService(orders, repo, new FakeReceiptRepo());
        var p = await svc.PreviewAsync(700);
        Assert.Equal(55, p.Lines.Single(x => x.LinkCode == "L-300").SuggestedProductId);
    }

    [Fact]
    public async Task Preview_missing_order_throws()
    {
        var svc = new ReceiveService(new FakeOrders { Detail = null }, new FakeReceiveRepo(), new FakeReceiptRepo());
        await Assert.ThrowsAsync<System.ComponentModel.DataAnnotations.ValidationException>(() => svc.PreviewAsync(999));
    }

    [Fact]
    public async Task Confirm_creates_order_receipt_with_link_traceability()
    {
        var orders = new FakeOrders { Detail = MakeOrder() };
        var receiptRepo = new FakeReceiptRepo();
        var svc = new ReceiveService(orders, new FakeReceiveRepo(), receiptRepo);

        var req = new ConfirmReceiveRequest
        {
            OrderId = 700,
            Lines = new()
            {
                new ConfirmReceiveLine(OrderLinkId: 1, LinkCode: "L-300", ProductId: null,
                    NewSku: "SKU-700-1", NewName: "Áo", Category: "apparel", ImageUrl: null, Qty: 3, UnitCost: 110_000),
            },
        };
        var n = await svc.ConfirmAsync(req);

        Assert.Equal(1, n);
        Assert.Equal("order", receiptRepo.LastCmd!.Source);
        Assert.Equal(700, receiptRepo.LastCmd.OrderId);
        Assert.Equal("L-300", receiptRepo.LastCmd.Lines[0].LinkCode);
        Assert.Equal(1, receiptRepo.LastCmd.Lines[0].OrderLinkId);
    }
}
