using FluentValidation;
using GomDon.Modules.Orders.Models;

namespace GomDon.Modules.Orders.Validators;

public sealed class IngestOrderRequestValidator : AbstractValidator<IngestOrderRequest>
{
    public static readonly HashSet<string> ValidStatuses = new()
    {
        "cho_coc", "dang_mua", "ve_vn", "kho_vn", "da_tra", "khieu_nai", "thanh_ly", "huy",
    };

    public IngestOrderRequestValidator()
    {
        RuleFor(x => x.ProductName).NotEmpty().WithMessage("Thiếu tên sản phẩm (productName).");
        RuleFor(x => x.CustomerName).NotEmpty().WithMessage("Thiếu tên khách hàng (customerName).");
        RuleFor(x => x.PlatformKey).NotEmpty().WithMessage("Thiếu sàn nguồn (platformKey).");
        RuleFor(x => x.Status).Must(s => ValidStatuses.Contains(s))
            .WithMessage(x => $"Trạng thái không hợp lệ: {x.Status}.");
        RuleFor(x => x.Rate).GreaterThan(0).WithMessage("Tỷ giá phải > 0.");
        RuleFor(x => x.BuyFeePct).InclusiveBetween(0, 100).WithMessage("% phí mua hàng phải trong khoảng 0–100.");
        RuleForEach(x => x.Packages).ChildRules(p =>
        {
            p.RuleFor(k => k.Code).NotEmpty().WithMessage("Kiện hàng thiếu mã (code).");
            p.RuleFor(k => k.Weight).GreaterThanOrEqualTo(0);
        });
    }
}
