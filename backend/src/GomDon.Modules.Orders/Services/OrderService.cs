using System.Text.RegularExpressions;
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

    // Ký tự Trung (chữ Hán + dấu câu/【】+ ký tự full-width) — dùng để DÒ và LOẠI bỏ.
    private static readonly Regex CjkChars = new(
        @"[　-〿㐀-䶿一-鿿豈-﫿＀-￯]+", RegexOptions.Compiled);
    private static readonly Regex MultiSpace = new(@"\s{2,}", RegexOptions.Compiled);

    /// <summary>Loại sạch mọi ký tự tiếng Trung, dọn khoảng trắng/dấu phân tách lẻ.</summary>
    private static string StripCjk(string s)
    {
        var t = MultiSpace.Replace(CjkChars.Replace(s, " "), " ").Trim();
        return t.Trim(' ', '-', '·', ',', '|', ':', '/').Trim();
    }

    /// <summary>Tên còn "đủ nghĩa" để hiển thị sau khi bỏ tiếng Trung: còn ≥ 6 ký tự chữ/số.
    /// Ngăn việc một tiêu đề chủ yếu tiếng Trung bị rút thành mẩu Latin lẻ (vd "ins").</summary>
    private static bool IsMeaningfulName(string s) => s.Count(char.IsLetterOrDigit) >= 6;

    // Từ điển màu/đặc điểm thường gặp — CHỈ dùng làm dự phòng khi AI lỗi/thiếu key
    // (dịch chính đã chuyển hoàn toàn sang AI). Giữ lại để offline vẫn có bản tối thiểu.
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

        // Dịch đặc điểm + TÊN sản phẩm (tiếng Trung) → Việt: HOÀN TOÀN qua AI.
        // Gộp mọi cụm còn chữ Hán vào 1 lần gọi AI (đặc điểm chưa dịch + tên).
        var toTranslate = req.Links
            .Where(l => string.IsNullOrWhiteSpace(l.SpecVi) && HasCjk(l.Spec)).Select(l => l.Spec!)
            .Concat(req.Links.Where(l => HasCjk(l.Name)).Select(l => l.Name!))
            .Distinct()
            .ToList();
        IReadOnlyDictionary<string, string> map = new Dictionary<string, string>();
        if (toTranslate.Count > 0)
            map = await _translation.TranslateAsync(toTranslate, ct);

        foreach (var l in req.Links)
        {
            // Đặc điểm: AI là nguồn chính, từ điển màu dự phòng khi AI lỗi/thiếu.
            if (string.IsNullOrWhiteSpace(l.SpecVi) && l.Spec != null)
            {
                if (map.TryGetValue(l.Spec, out var vi)) l.SpecVi = vi;
                else if (ColorMap.TryGetValue(l.Spec.Trim(), out var dictVi)) l.SpecVi = dictVi;
            }
            // Tên: AI dịch tại chỗ (không có từ điển dự phòng cho câu dài).
            if (HasCjk(l.Name) && map.TryGetValue(l.Name!, out var nameVi)) l.Name = nameVi;
        }

        // BẢO ĐẢM không còn tiếng Trung ở phần hiển thị (đặc điểm + tên). Nếu còn ký tự Hán
        // (AI dịch sót / rơi về bản gốc) thì loại sạch; loại xong rỗng → "(không rõ)" để FE
        // không rơi về hiển thị bản gốc tiếng Trung (FE dùng specVi || spec, name || …).
        foreach (var l in req.Links)
        {
            var spec = !string.IsNullOrWhiteSpace(l.SpecVi) ? l.SpecVi! : l.Spec;
            if (!string.IsNullOrWhiteSpace(spec) && CjkChars.IsMatch(spec))
            {
                var clean = StripCjk(spec);
                l.SpecVi = string.IsNullOrWhiteSpace(clean) ? "(không rõ)" : clean;
            }
            // Tên SP: KHÔNG strip thành rác. Nếu sau khi bỏ chữ Hán phần còn lại quá ngắn
            // (tên vốn chủ yếu là tiếng Trung, vd "ins风简约连衣裙" -> "ins"), thì GIỮ NGUYÊN
            // tên gốc (og:title) để người dùng thấy tên thật & tự sửa, thay vì mẩu Latin vô
            // nghĩa. Chỉ strip khi phần còn lại đủ nghĩa (tên vốn phần lớn là Latin/số).
            if (!string.IsNullOrWhiteSpace(l.Name) && CjkChars.IsMatch(l.Name))
            {
                var clean = StripCjk(l.Name);
                if (IsMeaningfulName(clean)) l.Name = clean;
            }
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
