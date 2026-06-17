using Dapper;
using FluentValidation;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Repositories;
using GomDon.Modules.Users.Services;
using GomDon.Modules.Users.Validators;
using Microsoft.Extensions.DependencyInjection;

namespace GomDon.Modules.Users;

public static class UsersModule
{
    public static IServiceCollection AddUsersModule(this IServiceCollection services)
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IValidator<RegisterRequest>, RegisterRequestValidator>();
        services.AddScoped<IValidator<CreateUserRequest>, CreateUserRequestValidator>();
        services.AddScoped<IValidator<ChangePasswordRequest>, ChangePasswordRequestValidator>();
        return services;
    }
}
