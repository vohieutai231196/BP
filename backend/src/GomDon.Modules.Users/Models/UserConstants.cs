namespace GomDon.Modules.Users.Models;

public static class UserRoles
{
    public const string Admin = "admin";
    public const string Staff = "staff";
    public const string Viewer = "viewer";
    public static readonly string[] All = { Admin, Staff, Viewer };
    public static bool IsValid(string? role) => role is not null && Array.IndexOf(All, role) >= 0;
}

public static class UserStatus
{
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Disabled = "disabled";
}
