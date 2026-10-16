using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Feature flags: every feature is DB-driven and can be switched off globally or per user.
/// All features default to on. Management is limited to system admins listed in
/// <c>Admin:Emails</c> (comma-separated) in server configuration.
/// </summary>
[Authorize]
[Route("api")]
public class FeaturesController(AppDbContext db, IFeatureFlags features, IConfiguration config, DoseWindowSettings doseWindow) : ApiControllerBase
{
    /// <summary>True when the caller's email is listed in <c>Admin:Emails</c>.</summary>
    private async Task<bool> IsSystemAdmin()
    {
        var admins = (config["Admin:Emails"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant()).ToHashSet();
        if (admins.Count == 0)
            return false;
        var email = await db.Users.Where(u => u.Id == CurrentUserId).Select(u => u.Email).FirstOrDefaultAsync();
        return email is not null && admins.Contains(email);
    }

    /// <summary>
    /// Effective feature values for the signed-in user (global value, overridden per user).
    /// </summary>
    /// <response code="200"><c>{ features: { key: bool }, isSystemAdmin, doseActionWindowHours }</c></response>
    [HttpGet("features")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Mine() =>
        Ok(new { features = await features.EffectiveAsync(CurrentUserId), isSystemAdmin = await IsSystemAdmin(), doseActionWindowHours = (await doseWindow.GetAsync()).TotalHours });

    /// <summary>
    /// Lists every flag with its description, global value and per-user overrides (system admins only).
    /// </summary>
    /// <response code="200">Flags.</response>
    /// <response code="403">Not a system admin.</response>
    [HttpGet("admin/features")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List()
    {
        if (!await IsSystemAdmin())
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only system admins can manage features." });
        var flags = await db.FeatureFlags.OrderBy(f => f.Key).ToListAsync();
        var overrides = await db.UserFeatureOverrides.Join(db.Users, o => o.UserId, u => u.Id, (o, u) => new { o.Key, o.UserId, u.Email, o.Enabled }).ToListAsync();
        return Ok(flags.Select(f => new { f.Key, f.Description, f.Enabled, f.UpdatedAt, Overrides = overrides.Where(o => o.Key == f.Key) }));
    }

    /// <summary>
    /// Turns a feature on or off for everyone (system admins only).
    /// </summary>
    /// <param name="key">Feature key.</param>
    /// <param name="r"><c>enabled</c>: true/false.</param>
    /// <response code="204">Updated.</response>
    /// <response code="403">Not a system admin.</response>
    /// <response code="404">Unknown feature.</response>
    [HttpPut("admin/features/{key}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetGlobal(string key, FeatureToggleRequest r)
    {
        if (!await IsSystemAdmin())
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only system admins can manage features." });
        var flag = await db.FeatureFlags.FindAsync(key);
        if (flag is null || r.Enabled is null)
            return NotFound(new { message = "Unknown feature." });
        flag.Enabled = r.Enabled.Value;
        flag.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        features.Invalidate();
        return NoContent();
    }

    /// <summary>
    /// Sets (true/false) or clears (null) a per-user override (system admins only).
    /// </summary>
    /// <param name="key">Feature key.</param>
    /// <param name="userId">User the override applies to.</param>
    /// <param name="r"><c>enabled</c>: true/false, or null to remove the override.</param>
    /// <response code="204">Updated.</response>
    /// <response code="403">Not a system admin.</response>
    [HttpPut("admin/features/{key}/users/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SetUser(string key, Guid userId, FeatureToggleRequest r)
    {
        if (!await IsSystemAdmin())
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only system admins can manage features." });
        if (!IFeatureFlags.Catalog.ContainsKey(key))
            return NotFound(new { message = "Unknown feature." });
        var existing = await db.UserFeatureOverrides.FirstOrDefaultAsync(o => o.UserId == userId && o.Key == key);
        if (r.Enabled is null)
        {
            if (existing is not null)
                db.UserFeatureOverrides.Remove(existing);
        }
        else if (existing is null)
        {
            db.UserFeatureOverrides.Add(new UserFeatureOverride { UserId = userId, Key = key, Enabled = r.Enabled.Value });
        }
        else
        {
            existing.Enabled = r.Enabled.Value;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        features.Invalidate();
        return NoContent();
    }
}
