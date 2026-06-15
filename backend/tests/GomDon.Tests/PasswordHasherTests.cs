using GomDon.Shared.Security;
using Xunit;

namespace GomDon.Tests;

public class PasswordHasherTests
{
    [Fact]
    public void Verify_returns_true_for_correct_password()
    {
        var hash = PasswordHasher.Hash("demo1234");
        Assert.True(PasswordHasher.Verify("demo1234", hash));
    }

    [Fact]
    public void Verify_returns_false_for_wrong_password()
    {
        var hash = PasswordHasher.Hash("demo1234");
        Assert.False(PasswordHasher.Verify("sai-mat-khau", hash));
    }

    [Fact]
    public void Hash_is_salted_so_two_hashes_differ()
    {
        Assert.NotEqual(PasswordHasher.Hash("x"), PasswordHasher.Hash("x"));
    }

    [Fact]
    public void Verify_returns_false_for_malformed_stored_hash()
    {
        Assert.False(PasswordHasher.Verify("x", "không-đúng-định-dạng"));
    }
}
