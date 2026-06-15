using Dapper;
using FluentValidation;
using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Repositories;
using GomDon.Modules.Orders.Services;
using GomDon.Modules.Orders.Validators;
using Microsoft.Extensions.DependencyInjection;

namespace GomDon.Modules.Orders;

public static class OrdersModule
{
    /// <summary>Đăng ký module Orders (repository + service + validator) và cấu hình Dapper.</summary>
    public static IServiceCollection AddOrdersModule(this IServiceCollection services)
    {
        // map snake_case (DB) ↔ PascalCase (C#) cho Dapper
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IValidator<IngestOrderRequest>, IngestOrderRequestValidator>();
        return services;
    }
}
