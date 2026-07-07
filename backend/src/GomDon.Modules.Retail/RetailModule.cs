using Dapper;
using FluentValidation;
using GomDon.Modules.Retail.Models;
using GomDon.Modules.Retail.Repositories;
using GomDon.Modules.Retail.Services;
using GomDon.Modules.Retail.Validators;
using Microsoft.Extensions.DependencyInjection;

namespace GomDon.Modules.Retail;

public static class RetailModule
{
    public static IServiceCollection AddRetailModule(this IServiceCollection services)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<ICostTypeRepository, CostTypeRepository>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<ICostTypeService, CostTypeService>();
        services.AddScoped<IValidator<CreateProductRequest>, CreateProductRequestValidator>();
        services.AddScoped<IValidator<CreateCostTypeRequest>, CreateCostTypeRequestValidator>();

        services.AddScoped<IStockRepository, StockRepository>();
        services.AddScoped<IReceiveRepository, ReceiveRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<IRetailSummaryRepository, RetailSummaryRepository>();
        services.AddScoped<IReceiveService, ReceiveService>();
        services.AddScoped<ISaleService, SaleService>();
        services.AddScoped<IRetailSummaryService, RetailSummaryService>();
        services.AddScoped<IValidator<CreateSaleRequest>, CreateSaleRequestValidator>();

        services.AddScoped<IPromotionRepository, PromotionRepository>();
        services.AddScoped<IPromotionService, PromotionService>();
        services.AddScoped<IValidator<CreatePromotionRequest>, CreatePromotionRequestValidator>();

        services.AddScoped<IComboRepository, ComboRepository>();
        services.AddScoped<IComboService, ComboService>();
        services.AddScoped<IValidator<CreateComboRequest>, CreateComboRequestValidator>();

        services.AddScoped<IReportRepository, ReportRepository>();
        services.AddScoped<IReportService, ReportService>();

        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<ISupplierService, SupplierService>();

        services.AddScoped<IReceiptRepository, ReceiptRepository>();
        services.AddScoped<IReceiptService, ReceiptService>();

        services.AddScoped<IStockService, StockService>();
        return services;
    }
}
