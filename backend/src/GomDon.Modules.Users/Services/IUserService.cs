using GomDon.Modules.Users.Models;
using GomDon.Shared;

namespace GomDon.Modules.Users.Services;

public interface IUserService
{
    Task RegisterAsync(RegisterRequest req, CancellationToken ct = default);
    Task<AuthResult> AuthenticateAsync(string email, string password, CancellationToken ct = default);
    Task<UserListItem> CreateAsync(CreateUserRequest req, CancellationToken ct = default);
    Task<PagedResult<UserListItem>> ListAsync(string? status, string? search, int page, int pageSize, CancellationToken ct = default);
    Task ApproveAsync(long id, string role, CancellationToken ct = default);
    Task RejectAsync(long id, CancellationToken ct = default);
    Task UpdateAsync(long id, UpdateUserRequest req, long actingUserId, CancellationToken ct = default);
    Task DisableAsync(long id, long actingUserId, CancellationToken ct = default);
    Task EnableAsync(long id, CancellationToken ct = default);
    Task AdminResetPasswordAsync(long id, string newPassword, CancellationToken ct = default);
    Task ChangeOwnPasswordAsync(long userId, string currentPassword, string newPassword, CancellationToken ct = default);
    Task UpdateOwnProfileAsync(long userId, string name, CancellationToken ct = default);
}
