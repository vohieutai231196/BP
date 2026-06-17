using System.ComponentModel.DataAnnotations;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Repositories;
using GomDon.Modules.Users.Services;
using GomDon.Modules.Users.Validators;
using GomDon.Shared;
using GomDon.Shared.Security;
using Xunit;

namespace GomDon.Tests;

public class UserServiceTests
{
    private sealed class FakeRepo : IUserRepository
    {
        public readonly List<User> Db = new();
        private long _seq = 1;

        public Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
            => Task.FromResult(Db.FirstOrDefault(u => u.Email.Equals(email, StringComparison.OrdinalIgnoreCase)));
        public Task<User?> GetByIdAsync(long id, CancellationToken ct = default)
            => Task.FromResult(Db.FirstOrDefault(u => u.Id == id));
        public Task<bool> EmailExistsAsync(string email, CancellationToken ct = default)
            => Task.FromResult(Db.Any(u => u.Email.Equals(email, StringComparison.OrdinalIgnoreCase)));
        public Task<long> InsertAsync(string email, string name, string passwordHash, string role, string status, CancellationToken ct = default)
        {
            var u = new User { Id = _seq++, Email = email, Name = name, PasswordHash = passwordHash, Role = role, Status = status };
            Db.Add(u); return Task.FromResult(u.Id);
        }
        public Task<PagedResult<UserListItem>> ListAsync(string? status, string? search, int page, int pageSize, CancellationToken ct = default)
        {
            var items = Db.Where(u => status == null || u.Status == status)
                .Select(u => new UserListItem(u.Id, u.Email, u.Name, u.Role, u.Status, u.CreatedAt)).ToList();
            return Task.FromResult(new PagedResult<UserListItem> { Items = items, Page = page, PageSize = pageSize, Total = items.Count });
        }
        public Task<bool> UpdateNameRoleAsync(long id, string name, string role, CancellationToken ct = default)
        { var u = Db.First(x => x.Id == id); u.Name = name; u.Role = role; return Task.FromResult(true); }
        public Task<bool> SetStatusAsync(long id, string status, CancellationToken ct = default)
        { var u = Db.First(x => x.Id == id); u.Status = status; return Task.FromResult(true); }
        public Task<bool> ApproveAsync(long id, string role, CancellationToken ct = default)
        { var u = Db.First(x => x.Id == id); if (u.Status != UserStatus.Pending) return Task.FromResult(false); u.Status = UserStatus.Active; u.Role = role; return Task.FromResult(true); }
        public Task<bool> SetPasswordAsync(long id, string passwordHash, CancellationToken ct = default)
        { var u = Db.First(x => x.Id == id); u.PasswordHash = passwordHash; return Task.FromResult(true); }
        public Task<bool> DeleteAsync(long id, CancellationToken ct = default)
        { return Task.FromResult(Db.RemoveAll(x => x.Id == id) > 0); }
        public Task<int> CountActiveAdminsAsync(CancellationToken ct = default)
        { return Task.FromResult(Db.Count(u => u.Role == UserRoles.Admin && u.Status == UserStatus.Active)); }
    }

    private static UserService Make(FakeRepo repo)
        => new(repo, new RegisterRequestValidator(), new CreateUserRequestValidator(), new ChangePasswordRequestValidator());

    private static User Seed(FakeRepo repo, string email, string role, string status, string pw = "secret1")
    { var id = repo.InsertAsync(email, email, PasswordHasher.Hash(pw), role, status).Result; return repo.Db.First(u => u.Id == id); }

    [Fact]
    public async Task Register_creates_pending_user()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        await svc.RegisterAsync(new RegisterRequest("new@x.com", "Mới", "secret1"));
        var u = repo.Db.Single();
        Assert.Equal(UserStatus.Pending, u.Status);
    }

    [Fact]
    public async Task Register_duplicate_email_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        Seed(repo, "dup@x.com", UserRoles.Staff, UserStatus.Active);
        await Assert.ThrowsAsync<ValidationException>(() => svc.RegisterAsync(new RegisterRequest("dup@x.com", "X", "secret1")));
    }

    [Fact]
    public async Task Authenticate_pending_returns_Pending()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        Seed(repo, "p@x.com", UserRoles.Staff, UserStatus.Pending);
        var r = await svc.AuthenticateAsync("p@x.com", "secret1");
        Assert.Equal(AuthOutcome.Pending, r.Outcome);
    }

    [Fact]
    public async Task Authenticate_disabled_returns_Disabled()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        Seed(repo, "d@x.com", UserRoles.Staff, UserStatus.Disabled);
        var r = await svc.AuthenticateAsync("d@x.com", "secret1");
        Assert.Equal(AuthOutcome.Disabled, r.Outcome);
    }

    [Fact]
    public async Task Authenticate_wrong_password_returns_InvalidCredentials()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        Seed(repo, "a@x.com", UserRoles.Admin, UserStatus.Active);
        var r = await svc.AuthenticateAsync("a@x.com", "wrong");
        Assert.Equal(AuthOutcome.InvalidCredentials, r.Outcome);
    }

    [Fact]
    public async Task Authenticate_success_returns_user()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        Seed(repo, "a@x.com", UserRoles.Admin, UserStatus.Active);
        var r = await svc.AuthenticateAsync("a@x.com", "secret1");
        Assert.Equal(AuthOutcome.Success, r.Outcome);
        Assert.NotNull(r.User);
    }

    [Fact]
    public async Task Approve_pending_sets_active_with_role()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var u = Seed(repo, "p@x.com", UserRoles.Staff, UserStatus.Pending);
        await svc.ApproveAsync(u.Id, UserRoles.Viewer);
        Assert.Equal(UserStatus.Active, u.Status);
        Assert.Equal(UserRoles.Viewer, u.Role);
    }

    [Fact]
    public async Task Approve_non_pending_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var u = Seed(repo, "a@x.com", UserRoles.Staff, UserStatus.Active);
        await Assert.ThrowsAsync<ValidationException>(() => svc.ApproveAsync(u.Id, UserRoles.Viewer));
    }

    [Fact]
    public async Task Reject_deletes_pending()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var u = Seed(repo, "p@x.com", UserRoles.Staff, UserStatus.Pending);
        await svc.RejectAsync(u.Id);
        Assert.Empty(repo.Db);
    }

    [Fact]
    public async Task Disable_self_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var admin = Seed(repo, "a1@x.com", UserRoles.Admin, UserStatus.Active);
        Seed(repo, "a2@x.com", UserRoles.Admin, UserStatus.Active); // còn admin khác
        await Assert.ThrowsAsync<ValidationException>(() => svc.DisableAsync(admin.Id, admin.Id));
    }

    [Fact]
    public async Task Disable_last_active_admin_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var admin = Seed(repo, "only@x.com", UserRoles.Admin, UserStatus.Active);
        await Assert.ThrowsAsync<ValidationException>(() => svc.DisableAsync(admin.Id, 999));
    }

    [Fact]
    public async Task Update_demote_last_admin_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var admin = Seed(repo, "only@x.com", UserRoles.Admin, UserStatus.Active);
        await Assert.ThrowsAsync<ValidationException>(() => svc.UpdateAsync(admin.Id, new UpdateUserRequest(null, UserRoles.Staff), 999));
    }

    [Fact]
    public async Task ChangeOwnPassword_wrong_current_throws()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var u = Seed(repo, "a@x.com", UserRoles.Staff, UserStatus.Active);
        await Assert.ThrowsAsync<ValidationException>(() => svc.ChangeOwnPasswordAsync(u.Id, "wrong", "newpass1"));
    }

    [Fact]
    public async Task ChangeOwnPassword_success_updates_hash()
    {
        var repo = new FakeRepo(); var svc = Make(repo);
        var u = Seed(repo, "a@x.com", UserRoles.Staff, UserStatus.Active);
        await svc.ChangeOwnPasswordAsync(u.Id, "secret1", "newpass1");
        Assert.True(PasswordHasher.Verify("newpass1", u.PasswordHash));
    }
}
