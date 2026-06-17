using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class CostTypeService : ICostTypeService
{
    private readonly ICostTypeRepository _repo;
    private readonly IValidator<CreateCostTypeRequest> _createValidator;

    public CostTypeService(ICostTypeRepository repo, IValidator<CreateCostTypeRequest> createValidator)
    {
        _repo = repo;
        _createValidator = createValidator;
    }

    public Task<List<CostType>> ListAsync(bool activeOnly, CancellationToken ct = default)
        => _repo.ListAsync(activeOnly, ct);

    public async Task<CostType> CreateAsync(CreateCostTypeRequest req, CancellationToken ct = default)
    {
        await _createValidator.ValidateAndThrowAsync(req, ct);
        var unit = string.IsNullOrWhiteSpace(req.Unit) ? "vnd" : req.Unit!;
        var id = await _repo.InsertAsync(req.Name.Trim(), req.DefaultAmount, unit, ct);
        return await Require(id, ct);
    }

    public async Task UpdateAsync(long id, UpdateCostTypeRequest req, CancellationToken ct = default)
    {
        var c = await Require(id, ct);
        var name = string.IsNullOrWhiteSpace(req.Name) ? c.Name : req.Name.Trim();
        var unit = string.IsNullOrWhiteSpace(req.Unit) ? c.Unit : req.Unit!;
        if (unit is not ("vnd" or "percent")) throw new ValidationException("Đơn vị không hợp lệ.");
        var amount = req.DefaultAmount ?? c.DefaultAmount;
        var active = req.Active ?? c.Active;
        await _repo.UpdateAsync(id, name, amount, unit, active, ct);
    }

    public async Task DeleteAsync(long id, CancellationToken ct = default)
    {
        await Require(id, ct);
        await _repo.DeleteAsync(id, ct);
    }

    private async Task<CostType> Require(long id, CancellationToken ct)
        => await _repo.GetByIdAsync(id, ct) ?? throw new ValidationException($"Không tìm thấy loại chi phí #{id}.");
}
