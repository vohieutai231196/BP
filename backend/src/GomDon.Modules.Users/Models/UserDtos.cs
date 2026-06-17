namespace GomDon.Modules.Users.Models;

public sealed record RegisterRequest(string Email, string Name, string Password);
public sealed record CreateUserRequest(string Email, string Name, string Role, string Password);
public sealed record UpdateUserRequest(string? Name, string? Role);
public sealed record ApproveRequest(string Role);
public sealed record AdminResetPasswordRequest(string NewPassword);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record UpdateProfileRequest(string Name);

public sealed record UserListItem(long Id, string Email, string Name, string Role, string Status, DateTime CreatedAt);

public enum AuthOutcome { Success, InvalidCredentials, Pending, Disabled }
public sealed record AuthResult(AuthOutcome Outcome, User? User);
