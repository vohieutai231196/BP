using FluentValidation;
using GomDon.Modules.Retail.Models;

namespace GomDon.Modules.Retail.Validators;

public sealed class CreateProductRequestValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductRequestValidator()
    {
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AvgCost).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ListPrice).GreaterThanOrEqualTo(0).When(x => x.ListPrice.HasValue);
    }
}

public sealed class CreateCostTypeRequestValidator : AbstractValidator<CreateCostTypeRequest>
{
    public CreateCostTypeRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Unit).Must(u => u is null or "vnd" or "percent")
            .WithMessage("Đơn vị chỉ nhận 'vnd' hoặc 'percent'.");
        RuleFor(x => x.DefaultAmount).GreaterThanOrEqualTo(0).When(x => x.DefaultAmount.HasValue);
    }
}

public sealed class CreateSaleRequestValidator : AbstractValidator<CreateSaleRequest>
{
    public CreateSaleRequestValidator()
    {
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(x => x.Qty).GreaterThan(0);
            i.RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0);
        });
    }
}

public sealed class CreateComboRequestValidator : AbstractValidator<CreateComboRequest>
{
    public CreateComboRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Items).NotEmpty().WithMessage("Combo cần ít nhất 1 sản phẩm.");
    }
}

public sealed class CreatePromotionRequestValidator : AbstractValidator<CreatePromotionRequest>
{
    public CreatePromotionRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Type).Must(t => t is null or "percent" or "fixed")
            .WithMessage("Loại KM chỉ nhận 'percent' hoặc 'fixed'.");
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
    }
}
