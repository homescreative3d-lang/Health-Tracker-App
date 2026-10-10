using System.Text.Json;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>
/// Notifies everyone who cares for a patient: the owner plus approved members of the owner's family.
/// </summary>
public interface ICareTeamNotifier
{
    /// <summary>
    /// Stores an in-app notification for each care-team member and sends a best-effort Web Push.
    /// </summary>
    /// <param name="patient">The patient the event concerns.</param>
    /// <param name="type">Notification type code (e.g. <c>dose_rescheduled</c>).</param>
    /// <param name="title">Short title.</param>
    /// <param name="message">Body text.</param>
    /// <param name="data">Extra payload serialized into <c>DataJson</c>.</param>
    /// <param name="ct">Cancellation token.</param>
    Task NotifyAsync(Patient patient, string type, string title, string message, object data, CancellationToken ct = default);
}

/// <summary>EF Core + Web Push implementation of <see cref="ICareTeamNotifier"/>.</summary>
/// <param name="db">Pooled database context.</param>
/// <param name="push">Web Push sender (best effort; failures don't block the action).</param>
public sealed class CareTeamNotifier(AppDbContext db, IPushNotificationService push) : ICareTeamNotifier
{
    /// <inheritdoc />
    public async Task NotifyAsync(Patient patient, string type, string title, string message, object data, CancellationToken ct = default)
    {
        var familyIds = await db.FamilyMembers
            .Where(m => m.UserId == patient.UserId && m.Status == "approved")
            .Select(m => m.FamilyId)
            .ToListAsync(ct);
        var recipients = await db.FamilyMembers
            .Where(m => familyIds.Contains(m.FamilyId) && m.Status == "approved")
            .Select(m => m.UserId)
            .ToListAsync(ct);
        recipients.Add(patient.UserId);
        var payload = JsonSerializer.Serialize(data);
        foreach (var userId in recipients.Distinct())
            db.Notifications.Add(new AppNotification { UserId = userId, Type = type, Title = title, Message = message, DataJson = payload });
        await db.SaveChangesAsync(ct);
        await push.SendToUsersAsync(recipients.Distinct(), title, message, type, null, ct);
    }
}
