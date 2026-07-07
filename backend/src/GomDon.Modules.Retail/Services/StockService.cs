using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Shared;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class StockService : IStockService
{
    private readonly IStockRepository _repo;
    public StockService(IStockRepository repo) => _repo = repo;

    public Task<PagedResult<StockMovementItem>> ListMovementsAsync(long productId, int page, int pageSize, CancellationToken ct = default)
        => _repo.ListMovementsAsync(productId, page, pageSize, ct);

    public Task<StockAdjustResult> AdjustAsync(AdjustStockRequest req, CancellationToken ct = default)
    {
        if (req.ActualQty < 0) throw new ValidationException("Số lượng thực tế không được âm.");
        var reason = string.IsNullOrWhiteSpace(req.Reason) ? "Điều chỉnh tồn" : req.Reason.Trim();
        return _repo.AdjustAsync(req.ProductId, req.ActualQty, reason, ct);
    }
}
