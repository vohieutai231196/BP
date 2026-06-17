namespace GomDon.Modules.Users.Models;

public sealed class User
{
    public long Id { get; init; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Status { get; set; } = "";
    public DateTime CreatedAt { get; init; }
}
