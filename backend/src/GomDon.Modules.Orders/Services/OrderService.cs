using FluentValidation;
using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Repositories;
using GomDon.Modules.Orders.Validators;
using GomDon.Shared;

namespace GomDon.Modules.Orders.Services;

public sealed class OrderService : IOrderService
{
    private static readonly Dictionary<string, string> StatusLabels = new()
    {
        ["cho_coc"] = "Chờ đặt cọc", ["dang_mua"] = "Đang mua hàng", ["ve_vn"] = "Đang về VN",
        ["kho_vn"] = "Trong kho VN", ["da_tra"] = "Đã trả hàng", ["khieu_nai"] = "Khiếu nại",
        ["thanh_ly"] = "Thanh lý", ["huy"] = "Đã hủy",
    };

    private readonly IOrderRepository _repo;
    private readonly IValidator<IngestOrderRequest> _ingestValidator;
    private readonly ITranslationService _translation;

    public OrderService(IOrderRepository repo, IValidator<IngestOrderRequest> ingestValidator, ITranslationService translation)
    {
        _repo = repo;
        _ingestValidator = ingestValidator;
        _translation = translation;
    }

    private static bool HasCjk(string? s) => !string.IsNullOrEmpty(s) && s.Any(c => c >= 0x4E00 && c <= 0x9FFF);

    // Từ điển màu/đặc điểm thường gặp — dịch offline, miễn phí (trước khi gọi Haiku).
    private static readonly Dictionary<string, string> ColorMap = new()
    {
        ["米色"] = "kem", ["米白色"] = "trắng kem", ["棕色"] = "nâu", ["黑色"] = "đen", ["白色"] = "trắng",
        ["卡其色"] = "kaki", ["卡其"] = "kaki", ["黄色"] = "vàng", ["粉色"] = "hồng", ["红色"] = "đỏ",
        ["蓝色"] = "xanh dương", ["绿色"] = "xanh lá", ["灰色"] = "xám", ["紫色"] = "tím", ["橙色"] = "cam",
        ["银色"] = "bạc", ["金色"] = "vàng kim", ["咖啡色"] = "nâu cà phê", ["深蓝色"] = "xanh đậm",
        ["天蓝色"] = "xanh da trời", ["军绿色"] = "xanh quân đội", ["酒红色"] = "đỏ rượu", ["藏青色"] = "xanh navy",
        ["杏色"] = "be", ["驼色"] = "nâu lạc đà", ["玫红色"] = "hồng sen", ["浅灰"] = "xám nhạt", ["深灰"] = "xám đậm",
    };

    public Task<PagedResult<OrderSummary>> ListAsync(OrderQuery query, CancellationToken ct = default)
        => _repo.ListAsync(query, ct);

    public Task<OrderDetail?> GetAsync(long id, CancellationToken ct = default)
        => _repo.GetByIdAsync(id, ct);

    public Task<DashboardSummary> GetDashboardAsync(CancellationToken ct = default)
        => _repo.GetDashboardAsync(ct);

    public async Task<long> IngestAsync(IngestOrderRequest req, CancellationToken ct = default)
    {
        await _ingestValidator.ValidateAndThrowAsync(req, ct);

        // Dịch đặc điểm sản phẩm (tiếng Trung) → Việt.
        // 1) Từ điển màu tĩnh (miễn phí, tức thì) cho các màu thường gặp.
        foreach (var l in req.Links)
            if (string.IsNullOrWhiteSpace(l.SpecVi) && l.Spec != null && ColorMap.TryGetValue(l.Spec.Trim(), out var dictVi))
                l.SpecVi = dictVi;

        // 2) Phần còn lại (không có trong từ điển) → gọi Haiku gộp 1 lần.
        var toTranslate = req.Links
            .Where(l => string.IsNullOrWhiteSpace(l.SpecVi) && HasCjk(l.Spec))
            .Select(l => l.Spec!)
            .Distinct()
            .ToList();
        if (toTranslate.Count > 0)
        {
            var map = await _translation.TranslateAsync(toTranslate, ct);
            foreach (var l in req.Links)
                if (string.IsNullOrWhiteSpace(l.SpecVi) && l.Spec != null && map.TryGetValue(l.Spec, out var vi))
                    l.SpecVi = vi;
        }

        return await _repo.IngestAsync(req, ct);
    }

    public async Task<bool> ChangeStatusAsync(long id, string status, string? note, CancellationToken ct = default)
    {
        if (!IngestOrderRequestValidator.ValidStatuses.Contains(status))
            throw new System.ComponentModel.DataAnnotations.ValidationException($"Trạng thái không hợp lệ: {status}.");

        var label = StatusLabels.TryGetValue(status, out var l) ? l : status;
        var text = string.IsNullOrWhiteSpace(note)
            ? $"Đơn chuyển trạng thái sang '{label}'."
            : $"Đơn chuyển trạng thái sang '{label}'. Ghi chú: {note}";

        return await _repo.UpdateStatusAsync(id, status, text, ct);
    }

    public Task<bool> DeleteAsync(long id, CancellationToken ct = default) => _repo.DeleteAsync(id, ct);
}
