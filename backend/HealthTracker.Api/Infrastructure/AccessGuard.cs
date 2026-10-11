using System.Security.Claims;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Infrastructure;

/// <summary>
/// Global request guard (runs before every controller action) enforcing three server-side rules:
/// <list type="number">
/// <item><b>Closed accounts</b>: soft-deleted users' tokens stop working immediately (401).</item>
/// <item><b>Feature flags</b>: endpoints marked <see cref="RequiresFeatureAttribute"/> are refused (403)
/// when the feature is off for the caller.</item>
/// <item><b>Patient portal</b>: users linked to a patient record are read-only. Allowed writes:
/// sign-in/password, notifications, their own account profile/deletion, and marking their own doses
/// taken/skipped/undone when the caregiver enabled it.</item>
/// </list>
/// </summary>
public sealed class AccessGuard(AppDbContext db, IFeatureFlags features) : IAsyncActionFilter
{
    /// <summary>Path prefixes a linked (read-only) patient may still write to.</summary>
    private static readonly string[] PatientWritable =
    [
        "/api/auth", "/api/password", "/api/notifications", "/api/family/notifications", "/api/account"
    ];

    /// <summary>Applies the rules, short-circuiting with a JSON error when a rule fails.</summary>
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (!Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            await next();
            return;
        }

        var user = await db.Users.Where(u => u.Id == userId).Select(u => new { u.IsDeleted }).FirstOrDefaultAsync();
        if (user is null || user.IsDeleted)
        {
            context.Result = new UnauthorizedObjectResult(new { message = "This account was closed. Sign up again with the same email to reactivate it." });
            return;
        }

        foreach (var required in context.ActionDescriptor.EndpointMetadata.OfType<RequiresFeatureAttribute>())
        {
            if (!await features.IsEnabledAsync(required.Key, userId))
            {
                context.Result = new ObjectResult(new { message = "This feature is turned off for your account.", feature = required.Key }) { StatusCode = StatusCodes.Status403Forbidden };
                return;
            }
        }

        var method = http.Request.Method;
        var isWrite = !(HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method));
        if (isWrite && await db.Patients.AnyAsync(p => p.LinkedUserId == userId) && !await PatientMayWrite(http, userId))
        {
            context.Result = new ObjectResult(new
            {
                message = "Your account is linked as a patient, so it's view-only. Ask your caregiver to make changes, or to remove the link.",
                readOnly = true
            }) { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        await next();
    }

    /// <summary>True for the limited writes a linked patient may perform.</summary>
    private async Task<bool> PatientMayWrite(HttpContext http, Guid userId)
    {
        var path = (http.Request.Path.Value ?? "").ToLowerInvariant();
        if (PatientWritable.Any(p => path.StartsWith(p)))
            return true;
        // /api/doses/{id}/taken|skip|undo on their own record, when the caregiver allows it.
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 4 && parts[1] == "doses" && parts[3] is "taken" or "skip" or "undo" && Guid.TryParse(parts[2], out var doseId))
        {
            return await db.DoseEvents.Where(d => d.Id == doseId)
                .Join(db.Patients, d => d.PatientId, p => p.Id, (d, p) => p)
                .AnyAsync(p => p.LinkedUserId == userId && p.CanMarkOwnDoses);
        }

        return false;
    }
}
