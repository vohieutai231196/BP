using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using Xunit;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Tests;

public class SupplierServiceTests
{
    private sealed class FakeRepo : ISupplierRepository
    {
        public List<Supplier> Items = new();
        public Task<List<Supplier>> ListAsync(bool activeOnly, CancellationToken ct = default)
            => Task.FromResult(activeOnly ? Items.Where(x => x.Active).ToList() : Items.ToList());
        public Task<Supplier> CreateAsync(SupplierRequest req, CancellationToken ct = default)
        {
            var s = new Supplier { Id = Items.Count + 1, Name = req.Name, Phone = req.Phone, Note = req.Note };
            Items.Add(s); return Task.FromResult(s);
        }
        public Task<bool> UpdateAsync(long id, SupplierRequest req, CancellationToken ct = default)
        {
            var s = Items.FirstOrDefault(x => x.Id == id);
            if (s is null) return Task.FromResult(false);
            s.Name = req.Name; s.Phone = req.Phone; s.Note = req.Note;
            if (req.Active is { } a) s.Active = a;
            return Task.FromResult(true);
        }
        public Task<SupplierDeleteOutcome> DeleteAsync(long id, CancellationToken ct = default)
        {
            var s = Items.FirstOrDefault(x => x.Id == id);
            if (s is null) return Task.FromResult(SupplierDeleteOutcome.NotFound);
            Items.Remove(s); return Task.FromResult(SupplierDeleteOutcome.Deleted);
        }
    }

    private static SupplierService Make(FakeRepo repo) => new(repo);

    [Fact]
    public async Task Create_trims_name()
    {
        var repo = new FakeRepo();
        var s = await Make(repo).CreateAsync(new SupplierRequest("  Xưởng A  ", null, null, null));
        Assert.Equal("Xưởng A", s.Name);
    }

    [Fact]
    public async Task Create_empty_name_throws()
    {
        var repo = new FakeRepo();
        await Assert.ThrowsAsync<ValidationException>(
            () => Make(repo).CreateAsync(new SupplierRequest("  ", null, null, null)));
    }

    [Fact]
    public async Task Update_missing_returns_false()
    {
        var repo = new FakeRepo();
        Assert.False(await Make(repo).UpdateAsync(99, new SupplierRequest("X", null, null, null)));
    }
}
