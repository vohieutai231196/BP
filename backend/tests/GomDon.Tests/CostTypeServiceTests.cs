using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Xunit;

namespace GomDon.Tests;

public class CostTypeServiceTests
{
    private sealed class FakeRepo : ICostTypeRepository
    {
        public readonly List<CostType> Db = new();
        private long _seq = 1;
        public Task<List<CostType>> ListAsync(bool activeOnly, CancellationToken ct = default)
            => Task.FromResult(Db.Where(c => !activeOnly || c.Active).ToList());
        public Task<CostType?> GetByIdAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.FirstOrDefault(c => c.Id == id));
        public Task<long> InsertAsync(string name, long? defaultAmount, string unit, CancellationToken ct = default)
        { var c = new CostType { Id = _seq++, Name = name, DefaultAmount = defaultAmount, Unit = unit, Active = true }; Db.Add(c); return Task.FromResult(c.Id); }
        public Task<bool> UpdateAsync(long id, string name, long? defaultAmount, string unit, bool active, CancellationToken ct = default)
        { var c = Db.First(x => x.Id == id); c.Name = name; c.DefaultAmount = defaultAmount; c.Unit = unit; c.Active = active; return Task.FromResult(true); }
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.RemoveAll(x => x.Id == id) > 0);
    }

    private static CostTypeService Make(FakeRepo repo) => new(repo, new CreateCostTypeRequestValidator());

    [Fact]
    public async Task Create_defaults_unit_to_vnd()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var c = await svc.CreateAsync(new CreateCostTypeRequest("Ship", 18_000, null));
        Assert.Equal("vnd", c.Unit);
    }

    [Fact]
    public async Task Create_invalid_unit_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            svc.CreateAsync(new CreateCostTypeRequest("Sai", 1, "kg")));
    }

    [Fact]
    public async Task Update_missing_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await Assert.ThrowsAsync<ValidationException>(() =>
            svc.UpdateAsync(99, new UpdateCostTypeRequest("X", null, null, null)));
    }
}
