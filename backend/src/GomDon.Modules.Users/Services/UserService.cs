using FluentValidation;
using GomDon.Modules.Users.Models;
using GomDon.Modules.Users.Repositories;
using GomDon.Shared;
using GomDon.Shared.Security;
using ValidationException = System.ComponentModel.DataAnnotations.ValidationException;

namespace GomDon.Modules.Users.Services;

public sealed class UserService : IUserService
{
    private readonly IUserRepository _repo;
    private readonly IValidator<RegisterRequest> _registerValidator;
    private readonly IValidator<CreateUserRequest> _createValidator;
    private readonly IValidator<ChangePasswordRequest> _changePwValidator;

    public UserService(IUserRepository repo,
        IValidator<RegisterRequest> registerValidator,
        IValidator<CreateUserRequest> createValidator,
        IValidator<ChangePasswordRequest> changePwValidator)
    {
        _repo = repo;
        _registerValidator = registerValidator;
        _createValidator = createValidator;
        _changePwValidator = changePwValidator;
    }

    public async Task RegisterAsync(RegisterRequest req, CancellationToken ct = default)
    {
        await _registerValidator.ValidateAndThrowAsync(req, ct);
        if (await _repo.EmailExistsAsync(req.Email, ct))
            throw new ValidationException("Email đã được sử dụng.");
        await _repo.InsertAsync(req.Email.Trim(), req.Name.Trim(), PasswordHasher.Hash(req.Password),
            UserRoles.Staff, UserStatus.Pending, ct);
    }

    public async Task<AuthResult> AuthenticateAsync(string email, string password, CancellationToken ct = default)
    {
        var user = await _repo.GetByEmailAsync(email.Trim(), ct);
        if (user is null || !PasswordHasher.Verify(password, user.PasswordHash))
            return new AuthResult(AuthOutcome.InvalidCredentials, null);
        return user.Status switch
        {
            UserStatus.Pending => new AuthResult(AuthOutcome.Pending, null),
            UserStatus.Disabled => new AuthResult(AuthOutcome.Disabled, null),
            _ => new AuthResult(AuthOutcome.Success, user),
        };
    }

    public async Task<UserListItem> CreateAsync(CreateUserRequest req, CancellationToken ct = default)
    {
        await _createValidator.ValidateAndThrowAsync(req, ct);
        if (!UserRoles.IsValid(req.Role)) throw new ValidationException("Role không hợp lệ.");
        if (await _repo.EmailExistsAsync(req.Email, ct)) throw new ValidationException("Email đã được sử dụng.");
        var id = await _repo.InsertAsync(req.Email.Trim(), req.Name.Trim(), PasswordHasher.Hash(req.Password),
            req.Role, UserStatus.Active, ct);
        var user = await _repo.GetByIdAsync(id, ct);
        return ToListItem(user!);
    }

    public Task<PagedResult<UserListItem>> ListAsync(string? status, string? search, int page, int pageSize, CancellationToken ct = default)
        => _repo.ListAsync(status, search, page <= 0 ? 1 : page, pageSize is <= 0 or > 200 ? 20 : pageSize, ct);

    public async Task ApproveAsync(long id, string role, CancellationToken ct = default)
    {
        if (!UserRoles.IsValid(role)) throw new ValidationException("Role không hợp lệ.");
        var user = await Require(id, ct);
        if (user.Status != UserStatus.Pending) throw new ValidationException("Chỉ duyệt được tài khoản đang chờ.");
        await _repo.ApproveAsync(id, role, ct);
    }

    public async Task RejectAsync(long id, CancellationToken ct = default)
    {
        var user = await Require(id, ct);
        if (user.Status != UserStatus.Pending) throw new ValidationException("Chỉ từ chối được tài khoản đang chờ.");
        await _repo.DeleteAsync(id, ct);
    }

    public async Task UpdateAsync(long id, UpdateUserRequest req, long actingUserId, CancellationToken ct = default)
    {
        var user = await Require(id, ct);
        var newName = string.IsNullOrWhiteSpace(req.Name) ? user.Name : req.Name.Trim();
        var newRole = string.IsNullOrWhiteSpace(req.Role) ? user.Role : req.Role!;
        if (!UserRoles.IsValid(newRole)) throw new ValidationException("Role không hợp lệ.");
        if (user.Role == UserRoles.Admin && newRole != UserRoles.Admin)
        {
            if (id == actingUserId) throw new ValidationException("Không thể tự hạ quyền chính mình.");
            await EnsureNotLastActiveAdmin(ct);
        }
        await _repo.UpdateNameRoleAsync(id, newName, newRole, ct);
    }

    public async Task DisableAsync(long id, long actingUserId, CancellationToken ct = default)
    {
        var user = await Require(id, ct);
        if (id == actingUserId) throw new ValidationException("Không thể tự khóa chính mình.");
        if (user.Role == UserRoles.Admin && user.Status == UserStatus.Active)
            await EnsureNotLastActiveAdmin(ct);
        await _repo.SetStatusAsync(id, UserStatus.Disabled, ct);
    }

    public async Task EnableAsync(long id, CancellationToken ct = default)
    {
        await Require(id, ct);
        await _repo.SetStatusAsync(id, UserStatus.Active, ct);
    }

    public async Task AdminResetPasswordAsync(long id, string newPassword, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            throw new ValidationException("Mật khẩu mới tối thiểu 6 ký tự.");
        await Require(id, ct);
        await _repo.SetPasswordAsync(id, PasswordHasher.Hash(newPassword), ct);
    }

    public async Task ChangeOwnPasswordAsync(long userId, string currentPassword, string newPassword, CancellationToken ct = default)
    {
        await _changePwValidator.ValidateAndThrowAsync(new ChangePasswordRequest(currentPassword, newPassword), ct);
        var user = await Require(userId, ct);
        if (!PasswordHasher.Verify(currentPassword, user.PasswordHash))
            throw new ValidationException("Mật khẩu hiện tại không đúng.");
        await _repo.SetPasswordAsync(userId, PasswordHasher.Hash(newPassword), ct);
    }

    public async Task UpdateOwnProfileAsync(long userId, string name, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ValidationException("Tên không được để trống.");
        var user = await Require(userId, ct);
        await _repo.UpdateNameRoleAsync(userId, name.Trim(), user.Role, ct);
    }

    private async Task<User> Require(long id, CancellationToken ct)
        => await _repo.GetByIdAsync(id, ct) ?? throw new ValidationException($"Không tìm thấy người dùng #{id}.");

    private async Task EnsureNotLastActiveAdmin(CancellationToken ct)
    {
        if (await _repo.CountActiveAdminsAsync(ct) <= 1)
            throw new ValidationException("Không thể thao tác trên admin hoạt động cuối cùng.");
    }

    private static UserListItem ToListItem(User u) => new(u.Id, u.Email, u.Name, u.Role, u.Status, u.CreatedAt);
}
