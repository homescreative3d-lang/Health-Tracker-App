using HealthTracker.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>
/// How long after its scheduled time a dose can still be marked taken/skipped (or undone).
/// Stored in the database as <c>ServerSettings</c> key <c>doses.actionWindowHours</c> (default 12,
/// allowed 1–72) so it can be changed without a redeploy; cached for one minute.
/// </summary>
public sealed class DoseWindowSettings(IServiceScopeFactory scopes)
{
    /// <summary>Default window when the setting is missing or invalid.</summary>
    public static readonly TimeSpan Default = TimeSpan.FromHours(12);

    private TimeSpan cached = Default;
    private DateTimeOffset loadedAt = DateTimeOffset.MinValue;

    /// <summary>Current window length.</summary>
    public async Task<TimeSpan> GetAsync(CancellationToken ct = default)
    {
        if (DateTimeOffset.UtcNow - loadedAt < TimeSpan.FromMinutes(1))
            return cached;
        try
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var raw = await db.ServerSettings.Where(s => s.Key == "doses.actionWindowHours").Select(s => s.Value).FirstOrDefaultAsync(ct);
            cached = double.TryParse(raw, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var h)
                ? TimeSpan.FromHours(Math.Clamp(h, 1, 72))
                : Default;
        }
        catch
        {
            // keep the last known value
        }

        loadedAt = DateTimeOffset.UtcNow;
        return cached;
    }
}
