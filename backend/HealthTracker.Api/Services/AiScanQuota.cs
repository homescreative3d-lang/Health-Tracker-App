using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>Current AI scan allowance for a user.</summary>
/// <param name="Limit">Scans allowed per rolling 24 hours.</param>
/// <param name="Used">Scans used in the last 24 hours.</param>
/// <param name="Remaining">Scans left.</param>
/// <param name="ResetsAt">When the oldest counted scan drops out of the window (null when none used).</param>
public record AiQuota(int Limit, int Used, int Remaining, DateTimeOffset? ResetsAt);

/// <summary>
/// Per-user daily limit on AI scans (rolling 24 hours). The default lives in the database
/// (<c>ServerSettings</c> key <c>ai.scanDailyLimit</c>, seeded to 5) and can be overridden per user
/// with <c>Users.AiScanDailyLimit</c> — both changeable directly in the database, no redeploy.
/// </summary>
public interface IAiScanQuota
{
    /// <summary>Reads the user's current allowance.</summary>
    Task<AiQuota> GetAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Records one scan attempt (counted whether or not the AI could read the image).</summary>
    Task RecordAsync(Guid userId, bool succeeded, CancellationToken ct = default);
}

/// <summary>EF Core implementation of <see cref="IAiScanQuota"/>.</summary>
public sealed class AiScanQuota(AppDbContext db) : IAiScanQuota
{
    private const int FallbackLimit = 5;

    /// <inheritdoc />
    public async Task<AiQuota> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var userLimit = await db.Users.Where(u => u.Id == userId).Select(u => u.AiScanDailyLimit).FirstOrDefaultAsync(ct);
        var setting = await db.ServerSettings.Where(s => s.Key == "ai.scanDailyLimit").Select(s => s.Value).FirstOrDefaultAsync(ct);
        var limit = Math.Max(0, userLimit ?? (int.TryParse(setting, out var v) ? v : FallbackLimit));
        var since = DateTimeOffset.UtcNow.AddHours(-24);
        var recent = await db.AiScanLogs.Where(l => l.UserId == userId && l.At > since).Select(l => l.At).ToListAsync(ct);
        var used = recent.Count;
        DateTimeOffset? resets = used > 0 ? recent.Min().AddHours(24) : null;
        return new AiQuota(limit, used, Math.Max(0, limit - used), resets);
    }

    /// <inheritdoc />
    public async Task RecordAsync(Guid userId, bool succeeded, CancellationToken ct = default)
    {
        db.AiScanLogs.Add(new AiScanLog { UserId = userId, Succeeded = succeeded });
        await db.SaveChangesAsync(ct);
    }
}
