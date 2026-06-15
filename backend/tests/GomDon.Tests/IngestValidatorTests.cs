using GomDon.Modules.Orders.Models;
using GomDon.Modules.Orders.Validators;
using Xunit;

namespace GomDon.Tests;

public class IngestValidatorTests
{
    private readonly IngestOrderRequestValidator _v = new();

    private static IngestOrderRequest Valid() => new()
    {
        ProductName = "Giày sneaker",
        CustomerName = "Nguyễn A",
        PlatformKey = "taobao",
        Status = "cho_coc",
        Rate = 4035,
        BuyFeePct = 1,
    };

    [Fact]
    public void Valid_request_passes() => Assert.True(_v.Validate(Valid()).IsValid);

    [Fact]
    public void Empty_product_fails()
    {
        var r = Valid(); r.ProductName = "";
        Assert.False(_v.Validate(r).IsValid);
    }

    [Fact]
    public void Empty_customer_fails()
    {
        var r = Valid(); r.CustomerName = "";
        Assert.False(_v.Validate(r).IsValid);
    }

    [Theory]
    [InlineData("sai")]
    [InlineData("")]
    [InlineData("DONE")]
    public void Invalid_status_fails(string status)
    {
        var r = Valid(); r.Status = status;
        Assert.False(_v.Validate(r).IsValid);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    public void Nonpositive_rate_fails(int rate)
    {
        var r = Valid(); r.Rate = rate;
        Assert.False(_v.Validate(r).IsValid);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(200)]
    public void Buyfee_out_of_range_fails(int pct)
    {
        var r = Valid(); r.BuyFeePct = pct;
        Assert.False(_v.Validate(r).IsValid);
    }

    [Fact]
    public void Package_without_code_fails()
    {
        var r = Valid();
        r.Packages.Add(new IngestPackage { Code = "", Weight = 1 });
        Assert.False(_v.Validate(r).IsValid);
    }
}
