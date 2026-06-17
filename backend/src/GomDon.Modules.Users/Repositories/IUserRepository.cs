using GomDon.Modules.Users.Models;
using GomDon.Shared;

namespace GomDon.Modules.Users.Repositories;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdAsync(long id, CancellationToken ct = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken ct = default);
    Task<long> InsertAsync(string email, string name, string passwordHash, string role, string status, CancellationToken ct = default);
    Task<PagedResult<UserListItem>> ListAsync(string? status, string? search, int page, int pageSize, CancellationToken ct = default);
    Task<bool> UpdateNameRoleAsync(long id, string name, string role, CancellationToken ct = default);
    Task<bool> SetStatusAsync(long id, string status, CancellationToken ct = default);
    Task<bool> ApproveAsync(long id, string role, CancellationToken ct = default);
    Task<bool> SetPasswordAsync(long id, string passwordHash, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, CancellationToken ct = default);
    Task<int> CountActiveAdminsAsync(CancellationToken ct = default);
}
