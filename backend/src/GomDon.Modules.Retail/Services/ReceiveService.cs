using GomDon.Modules.Orders.Services;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Pricing;
using GomDon.Modules.Retail.Repositories;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Retail.Services;

public sealed class ReceiveService : IReceiveService
{
    private readonly IOrderService _orders;
    private readonly IReceiveRepository _repo;
    private readonly IReceiptRepository _receipts;

    public ReceiveService(IOrderService orders, IReceiveRepository repo, IReceiptRepository receipts)
    {
        _orders = orders;
        _repo = repo;
        _receipts = receipts;
    }

    public async Task<ReceivePreview> PreviewAsync(long orderId, CancellationToken ct = default)
    {
        var order = await _orders.GetAsync(orderId, ct)
            ?? throw new ValidationException($"Không tìm thấy đơn #{orderId}.");

        var c = order.Costs;
        long sharedCost = c.PhiTraThem + c.ShipTQ + c.PhiMuaHang + c.PhiKiemDem
                          + c.TienCanNang + c.DongGo + c.CuocPhatSinh + c.LuuKho;

        var inputs = order.Links
            .Select(l => new AllocInput(l.Idx, l.PriceVnd, ParseQty(l.Qty)))
            .ToList();
        var alloc = LandedCostAllocator.Allocate(inputs, sharedCost)
            .ToDictionary(a => a.OrderLinkId);

        var preview = new ReceivePreview { OrderId = orderId, SharedCost = sharedCost };
        foreach (var l in order.Links)
        {
            var a = alloc[l.Idx];
            var suggested = await _repo.FindProductByLinkCodeAsync(l.LinkCode, ct);
            // Tên gợi ý: ƯU TIÊN tên sản phẩm thật (đã dịch); chỉ rơi về đặc điểm khi chưa có tên.
            var nameGuess =
                !string.IsNullOrWhiteSpace(l.Name) ? l.Name!
                : !string.IsNullOrWhiteSpace(l.SpecVi) ? l.SpecVi!
                : !string.IsNullOrWhiteSpace(l.Spec) ? l.Spec!
                : $"SP {l.LinkCode}";
            preview.Lines.Add(new ReceiveLinePreview
            {
                OrderLinkId = l.Idx, LinkCode = l.LinkCode, Spec = l.Spec, SpecVi = l.SpecVi,
                ImageUrl = l.ImageUrl, PriceVnd = l.PriceVnd, Qty = ParseQty(l.Qty),
                UnitCost = a.UnitCost, SuggestedProductId = suggested,
                SuggestedSku = $"SKU-{orderId}-{l.Idx}", SuggestedName = nameGuess,
            });
        }
        return preview;
    }

    /// <summary>Nhận từ đơn mua hộ = tạo phiếu nhập source='order' — đi chung đường ghi kho.</summary>
    public async Task<int> ConfirmAsync(ConfirmReceiveRequest req, CancellationToken ct = default)
    {
        if (req.Lines.Count == 0) throw new ValidationException("Không có dòng nào để nhận kho.");
        var lines = req.Lines.Select(l => new ReceiptLineCommand(
            ProductId: l.ProductId, NewSku: l.NewSku, NewName: l.NewName,
            Category: l.Category, ImageUrl: l.ImageUrl,
            Qty: l.Qty, UnitCost: l.UnitCost,
            OrderLinkId: l.OrderLinkId, LinkCode: l.LinkCode)).ToList();
        var created = await _receipts.CreateAsync(new CreateReceiptCommand(
            Source: "order", OrderId: req.OrderId, SupplierId: null,
            Note: $"Nhận từ đơn #{req.OrderId}", ReceivedAt: null, CreatedBy: null, Lines: lines), ct);
        return created.LineCount;
    }

    /// <summary>Parse số lượng nhận từ chuỗi qty kiểu "5/5/5" → lấy số cuối; lỗi → 1.</summary>
    internal static int ParseQty(string? qty)
    {
        if (string.IsNullOrWhiteSpace(qty)) return 1;
        var parts = qty.Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        for (int i = parts.Length - 1; i >= 0; i--)
            if (int.TryParse(parts[i], out var n) && n > 0) return n;
        return 1;
    }
}
