using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class PromotionService : IPromotionService
{
    private readonly IPromotionRepository _repo;
    private readonly IValidator<CreatePromotionRequest> _validator;

    public PromotionService(IPromotionRepository repo, IValidator<CreatePromotionRequest> validator)
    {
        _repo = repo;
        _validator = validator;
    }

    public Task<List<PromotionListItem>> ListAsync(CancellationToken ct = default) => _repo.ListAsync(ct);
    public Task<List<long>> GetProductIdsAsync(long id, CancellationToken ct = default) => _repo.GetProductIdsAsync(id, ct);

    public async Task<long> CreateAsync(CreatePromotionRequest req, CancellationToken ct = default)
    {
        await _validator.ValidateAndThrowAsync(req, ct);
        var type = string.IsNullOrWhiteSpace(req.Type) ? "percent" : req.Type!;
        return await _repo.InsertAsync(req.Name.Trim(), type, req.Value, req.StartAt, req.EndAt,
            req.ProductIds ?? new List<long>(), ct);
    }

    public async Task UpdateAsync(long id, UpdatePromotionRequest req, CancellationToken ct = default)
    {
        var p = await _repo.GetByIdAsync(id, ct) ?? throw new ValidationException($"Không tìm thấy KM #{id}.");
        var name = string.IsNullOrWhiteSpace(req.Name) ? p.Name : req.Name.Trim();
        var type = string.IsNullOrWhiteSpace(req.Type) ? p.Type : req.Type!;
        if (type is not ("percent" or "fixed")) throw new ValidationException("Loại KM không hợp lệ.");
        var value = req.Value ?? p.Value;
        var active = req.Active ?? p.Active;
        var ids = req.ProductIds ?? await _repo.GetProductIdsAsync(id, ct);
        await _repo.UpdateAsync(id, name, type, value, req.StartAt ?? p.StartAt, req.EndAt ?? p.EndAt, active, ids, ct);
    }

    public async Task DeleteAsync(long id, CancellationToken ct = default)
    {
        await _repo.GetByIdAsync(id, ct);
        await _repo.DeleteAsync(id, ct);
    }

    public async Task<List<ActivePromotion>> GetActiveAsync(DateTime now, CancellationToken ct = default)
    {
        var raw = await _repo.GetActiveRawAsync(now, ct);
        return raw
            .Select(r => new ActivePromotion(r.ProductId, r.PromotionId, r.Name, r.Type, r.Value,
                PromotionCalculator.EffectivePrice(r.ListPrice, r.Type, r.Value)))
            .GroupBy(a => a.ProductId)
            .Select(g => g.OrderBy(a => a.Price).First())
            .ToList();
    }
}
