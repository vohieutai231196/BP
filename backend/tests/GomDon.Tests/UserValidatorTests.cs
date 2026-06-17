using FluentValidation;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Validators;
using Xunit;

namespace GomDon.Tests;

public class UserValidatorTests
{
    [Fact]
    public async Task Register_rejects_bad_email_and_short_password()
    {
        var v = new RegisterRequestValidator();
        var r = await v.ValidateAsync(new RegisterRequest("not-an-email", "", "123"));
        Assert.False(r.IsValid);
        Assert.Contains(r.Errors, e => e.PropertyName == nameof(RegisterRequest.Email));
        Assert.Contains(r.Errors, e => e.PropertyName == nameof(RegisterRequest.Name));
        Assert.Contains(r.Errors, e => e.PropertyName == nameof(RegisterRequest.Password));
    }

    [Fact]
    public async Task Register_accepts_valid()
    {
        var v = new RegisterRequestValidator();
        var r = await v.ValidateAsync(new RegisterRequest("a@b.com", "Nguyễn A", "secret1"));
        Assert.True(r.IsValid);
    }

    [Fact]
    public async Task ChangePassword_requires_current_and_min6_new()
    {
        var v = new ChangePasswordRequestValidator();
        var r = await v.ValidateAsync(new ChangePasswordRequest("", "123"));
        Assert.False(r.IsValid);
    }
}
