namespace HealthTracker.Api.Models;

public class NotificationRuntimeConfig
{
    // A single-row configuration table: only Id = 1 is valid.
    public int Id { get; set; } = 1;
    public bool Enabled { get; set; } = true;
    public string ActiveProvider { get; set; } = "dotnet";
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
