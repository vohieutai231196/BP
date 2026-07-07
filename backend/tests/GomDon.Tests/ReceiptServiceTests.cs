using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Shared;
using Xunit;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Tests;

public class ReceiptServiceTests
{
    private sealed class FakeRepo : IReceiptRepository
    {
        public CreateReceiptCommand? LastCmd;
        public Task<ReceiptCreated> CreateAsync(CreateReceiptCommand cmd, CancellationToken ct = default)
        { LastCmd = cmd; return Task.FromResult(new ReceiptCreated(1, "PN-260707-1", cmd.Lines.Count)); }
        public Task<PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default)
            => Task.FromResult(new PagedResult<ReceiptListItem>());
        public Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default)
            => Task.FromResult<ReceiptDetail?>(null);
    }

    private static CreateReceiptRequest Valid(string source = "manual", long? supplierId = 5) => new()
    {
        Source = source, SupplierId = supplierId,
        Items = new()
        {
            new CreateReceiptItemRequest(ProductId: 10, NewProduct: null, Qty: 2, UnitCost: 30_000),
            new CreateReceiptItemRequest(ProductId: null,
                NewProduct: new NewProductInput("SKU-M1", "Áo mới", "apparel", 99_000), Qty: 1, UnitCost: 40_000),
        },
    };

    [Fact]
    public async Task Manual_receipt_maps_lines_and_supplier()
    {
        var repo = new FakeRepo();
        var svc = new ReceiptService(repo);
        var r = await svc.CreateAsync(Valid(), createdBy: 7);

        Assert.Equal(2, r.LineCount);
        Assert.Equal("manual", repo.LastCmd!.Source);
        Assert.Equal(5, repo.LastCmd.SupplierId);
        Assert.Equal(7, repo.LastCmd.CreatedBy);
        var newLine = repo.LastCmd.Lines[1];
        Assert.Equal("SKU-M1", newLine.NewSku);
        Assert.Equal("Áo mới", newLine.NewName);
        Assert.Equal("apparel", newLine.Category);
    }

    [Fact]
    public async Task Manual_without_supplier_throws()
    {
        var svc = new ReceiptService(new FakeRepo());
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(Valid(supplierId: null), null));
    }

    [Fact]
    public async Task Opening_without_supplier_ok()
    {
        var repo = new FakeRepo();
        var svc = new ReceiptService(repo);
        await svc.CreateAsync(Valid(source: "opening", supplierId: null), null);
        Assert.Equal("opening", repo.LastCmd!.Source);
        Assert.Null(repo.LastCmd.SupplierId);
    }

    [Fact]
    public async Task Empty_items_throws()
    {
        var svc = new ReceiptService(new FakeRepo());
        var req = Valid(); req.Items.Clear();
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req, null));
    }

    [Fact]
    public async Task Bad_source_throws()
    {
        var svc = new ReceiptService(new FakeRepo());
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(Valid(source: "order"), null));
    }

    [Fact]
    public async Task Item_without_product_or_new_throws()
    {
        var svc = new ReceiptService(new FakeRepo());
        var req = Valid();
        req.Items.Add(new CreateReceiptItemRequest(null, null, 1, 1000));
        await Assert.ThrowsAsync<ValidationException>(() => svc.CreateAsync(req, null));
    }
}
