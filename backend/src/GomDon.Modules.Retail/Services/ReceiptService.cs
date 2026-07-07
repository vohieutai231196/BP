using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Shared;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class ReceiptService : IReceiptService
{
    private readonly IReceiptRepository _repo;
    public ReceiptService(IReceiptRepository repo) => _repo = repo;

    public Task<ReceiptCreated> CreateAsync(CreateReceiptRequest req, long? createdBy, CancellationToken ct = default)
    {
        if (req.Source is not ("manual" or "opening"))
            throw new ValidationException("Nguồn phiếu chỉ nhận 'manual' hoặc 'opening'. (Nhận từ đơn mua hộ dùng /v1/retail/receive/confirm.)");
        if (req.Source == "manual" && req.SupplierId is null)
            throw new ValidationException("Phiếu nhập từ NCC cần chọn nhà cung cấp.");
        if (req.Items.Count == 0)
            throw new ValidationException("Phiếu nhập không có dòng nào.");

        var lines = new List<ReceiptLineCommand>();
        foreach (var it in req.Items)
        {
            if (it.Qty <= 0) throw new ValidationException("Số lượng mỗi dòng phải > 0.");
            if (it.UnitCost < 0) throw new ValidationException("Giá vốn không được âm.");
            if (it.ProductId is null && it.NewProduct is null)
                throw new ValidationException("Mỗi dòng cần chọn SKU có sẵn hoặc tạo SKU mới.");
            if (it.ProductId is null && string.IsNullOrWhiteSpace(it.NewProduct!.Sku))
                throw new ValidationException("SKU mới không được trống.");

            lines.Add(new ReceiptLineCommand(
                ProductId: it.ProductId,
                NewSku: it.NewProduct?.Sku?.Trim(),
                NewName: it.NewProduct?.Name?.Trim(),
                Category: it.NewProduct?.Category,
                ImageUrl: null,
                Qty: it.Qty, UnitCost: it.UnitCost));
        }

        var cmd = new CreateReceiptCommand(
            Source: req.Source,
            OrderId: null,
            SupplierId: req.Source == "manual" ? req.SupplierId : null,
            Note: req.Note, ReceivedAt: req.ReceivedAt, CreatedBy: createdBy, Lines: lines);
        return _repo.CreateAsync(cmd, ct);
    }

    public Task<PagedResult<ReceiptListItem>> ListAsync(ReceiptQuery q, CancellationToken ct = default)
        => _repo.ListAsync(q, ct);

    public Task<ReceiptDetail?> GetAsync(long id, CancellationToken ct = default)
        => _repo.GetAsync(id, ct);
}
