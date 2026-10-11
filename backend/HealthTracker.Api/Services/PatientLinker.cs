using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>
/// Links patient records to user accounts by email (patient portal).
/// </summary>
/// <remarks>
/// <list type="bullet">
/// <item>When a caregiver sets a patient's email and an account with that email exists, it is linked.</item>
/// <item>When someone signs up or logs in with an email that a patient record carries, they are linked.</item>
/// <item>Linked users get a read-only view of that patient (enforced by <c>AccessGuard</c>) until the
/// caregiver/admin removes or changes the email, which unlinks them.</item>
/// <item>Both sides are notified, so a link never happens silently.</item>
/// </list>
/// </remarks>
public interface IPatientLinker
{
    /// <summary>Links every unlinked patient carrying the user's email to the user.</summary>
    Task LinkByEmailAsync(AppUser user, CancellationToken ct = default);

    /// <summary>Re-evaluates a patient's link after its email changed (links, re-links or unlinks).</summary>
    Task SyncPatientAsync(Patient patient, string previousEmail, CancellationToken ct = default);
}

/// <summary>EF Core implementation of <see cref="IPatientLinker"/>.</summary>
public sealed class PatientLinker(AppDbContext db, IPushNotificationService push) : IPatientLinker
{
    /// <inheritdoc />
    public async Task LinkByEmailAsync(AppUser user, CancellationToken ct = default)
    {
        var email = user.Email.Trim().ToLowerInvariant();
        var patients = await db.Patients.Where(p => p.Email == email && p.LinkedUserId == null && p.UserId != user.Id).ToListAsync(ct);
        foreach (var p in patients)
            await Link(p, user, ct);
        if (patients.Count > 0)
            await db.SaveChangesAsync(ct);
    }

    /// <inheritdoc />
    public async Task SyncPatientAsync(Patient patient, string previousEmail, CancellationToken ct = default)
    {
        var email = patient.Email.Trim().ToLowerInvariant();
        if (email == (previousEmail ?? "").Trim().ToLowerInvariant() && (patient.LinkedUserId.HasValue || email.Length == 0))
            return;
        if (patient.LinkedUserId is Guid oldUser)
        {
            patient.LinkedUserId = null;
            Note(oldUser, "patient_unlinked", "Patient access removed", $"Your read-only access to {patient.Name}'s care plan was removed by their caregiver.", patient.Id);
        }

        if (email.Length > 0)
        {
            var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && !u.IsDeleted && u.Id != patient.UserId, ct);
            if (user is not null)
                await Link(patient, user, ct);
        }
    }

    /// <summary>Sets the link and notifies the linked user and the patient's owner.</summary>
    private async Task Link(Patient patient, AppUser user, CancellationToken ct)
    {
        patient.LinkedUserId = user.Id;
        Note(user.Id, "patient_linked", "You can now view your care plan",
            $"Your account is linked to the patient profile “{patient.Name}”. You can see medicines, history and your caregivers; changes are made by your caregiver.", patient.Id);
        Note(patient.UserId, "patient_linked", "Patient account linked",
            $"{user.DisplayName} ({user.Email}) can now view {patient.Name}'s plan (read-only).", patient.Id);
        await push.SendToUsersAsync([user.Id, patient.UserId], "Patient account linked", $"{patient.Name}'s care plan is now visible to {user.DisplayName}.", "patient_linked", null, ct);
    }

    /// <summary>Queues an in-app notification (saved by the caller).</summary>
    private void Note(Guid userId, string type, string title, string message, Guid patientId) =>
        db.Notifications.Add(new AppNotification { UserId = userId, Type = type, Title = title, Message = message, DataJson = System.Text.Json.JsonSerializer.Serialize(new { patientId }) });
}
