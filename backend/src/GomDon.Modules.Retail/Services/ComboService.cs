using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class ComboService : IComboService
{
    private readonly IComboRepository _repo;
    private readonly IProductRepository _products;
    private readonly IValidator<CreateComboRequest> _validator;

    public ComboService(IComboRepository repo, IProductRepository products, IValidator<CreateComboRequest> validator)
    {
        _repo = repo;
        _products = products;
        _validator = validator;
    }

    public Task<List<ComboListItem>> ListAsync(CancellationToken ct = default) => _repo.ListAsync(ct);
    public Task<List<ComboComponent>> GetComponentsAsync(long id, CancellationToken ct = default) => _repo.GetComponentsAsync(id, ct);

    public async Task<long> CreateAsync(CreateComboRequest req, CancellationToken ct = default)
    {
        await _validator.ValidateAndThrowAsync(req, ct);
        await EnsureComponentsInStock(req.Items, ct);
        return await _repo.InsertAsync(req, ct);
    }

    public async Task UpdateAsync(long id, UpdateComboRequest req, CancellationToken ct = default)
    {
        var c = await _repo.GetByIdAsync(id, ct) ?? throw new ValidationException($"Không tìm thấy combo #{id}.");
        if (req.Items is not null) await EnsureComponentsInStock(req.Items, ct);
        var name = string.IsNullOrWhiteSpace(req.Name) ? c.Name : req.Name.Trim();
        await _repo.UpdateAsync(id, name, req.ImageUrl ?? c.ImageUrl, req.Price ?? c.Price, req.Active ?? c.Active, req.Items, ct);
    }

    public async Task DeleteAsync(long id, CancellationToken ct = default)
    {
        await _repo.GetByIdAsync(id, ct);
        await _repo.DeleteAsync(id, ct);
    }

    private async Task EnsureComponentsInStock(IReadOnlyList<CreateComboItemRequest> items, CancellationToken ct)
    {
        foreach (var it in items)
        {
            var (stock, _) = await _products.GetStockAndAvgAsync(it.ProductId, ct);
            if (stock <= 0)
                throw new ValidationException($"Sản phẩm #{it.ProductId} đang hết tồn — không tạo được combo.");
        }
    }
}
