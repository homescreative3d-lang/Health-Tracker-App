using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace HealthTracker.Api.Services;

/// <summary>
/// Database-driven feature flags with per-user overrides. Every feature defaults to <b>on</b>.
/// A per-user override wins over the global value. Values are cached for 30 seconds.
/// </summary>
public interface IFeatureFlags
{
    /// <summary>All known features with their descriptions.</summary>
    static readonly IReadOnlyDictionary<string, string> Catalog = new Dictionary<string, string>
    {
        ["medical_history"] = "Medical history timeline",
        ["prescription_scan"] = "AI prescription scanning",
        ["family_sharing"] = "Family groups and sharing",
        ["rescheduling"] = "Rescheduling doses and schedules",
        ["change_history"] = "Audit trail / change history",
        ["push_notifications"] = "Browser/device push notifications",
        ["patient_portal"] = "Linked patient (read-only) accounts",
        ["attachments"] = "Patient attachments and preview",
        ["in_app_camera"] = "In-app camera capture",
        ["phone_calls"] = "Tap-to-call phone links",
    };

    /// <summary>True when the feature is on for this user (unknown keys are on).</summary>
    Task<bool> IsEnabledAsync(string key, Guid? userId, CancellationToken ct = default);

    /// <summary>Effective value of every feature for this user.</summary>
    Task<Dictionary<string, bool>> EffectiveAsync(Guid? userId, CancellationToken ct = default);

    /// <summary>Clears cached values after a change.</summary>
    void Invalidate();

    /// <summary>Inserts any missing catalog entries as enabled (startup).</summary>
    static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var existing = await db.FeatureFlags.Select(f => f.Key).ToListAsync();
        foreach (var (key, description) in Catalog.Where(c => !existing.Contains(c.Key)))
            db.FeatureFlags.Add(new FeatureFlag { Key = key, Enabled = true, Description = description });
        await db.SaveChangesAsync();
    }
}

/// <summary>EF Core + memory-cache implementation of <see cref="IFeatureFlags"/>.</summary>
public sealed class FeatureFlags(AppDbContext db, IMemoryCache cache) : IFeatureFlags
{
    private const string GlobalKey = "features:global";
    private static CancellationTokenSource reset = new();

    /// <inheritdoc />
    public async Task<bool> IsEnabledAsync(string key, Guid? userId, CancellationToken ct = default) =>
        !(await EffectiveAsync(userId, ct)).TryGetValue(key, out var on) || on;

    /// <inheritdoc />
    public async Task<Dictionary<string, bool>> EffectiveAsync(Guid? userId, CancellationToken ct = default)
    {
        var global = await cache.GetOrCreateAsync(GlobalKey, async e =>
        {
            Expire(e);
            return await db.FeatureFlags.ToDictionaryAsync(f => f.Key, f => f.Enabled, ct);
        }) ?? [];
        var result = IFeatureFlags.Catalog.Keys.ToDictionary(k => k, k => !global.TryGetValue(k, out var v) || v);
        if (userId is Guid uid)
        {
            var overrides = await cache.GetOrCreateAsync($"features:user:{uid}", async e =>
            {
                Expire(e);
                return await db.UserFeatureOverrides.Where(o => o.UserId == uid).ToDictionaryAsync(o => o.Key, o => o.Enabled, ct);
            }) ?? [];
            foreach (var (k, v) in overrides)
                result[k] = v;
        }

        return result;
    }

    /// <inheritdoc />
    public void Invalidate()
    {
        var old = reset;
        reset = new CancellationTokenSource();
        old.Cancel();
    }

    /// <summary>30-second expiry, cleared early by <see cref="Invalidate"/>.</summary>
    private static void Expire(ICacheEntry e)
    {
        e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
        e.AddExpirationToken(new Microsoft.Extensions.Primitives.CancellationChangeToken(reset.Token));
    }
}

/// <summary>
/// Marks an endpoint as part of a feature; when the feature is off for the caller the request
/// is rejected with 403 and a friendly message.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequiresFeatureAttribute(string key) : Attribute
{
    /// <summary>Feature key from <see cref="IFeatureFlags.Catalog"/>.</summary>
    public string Key { get; } = key;
}
