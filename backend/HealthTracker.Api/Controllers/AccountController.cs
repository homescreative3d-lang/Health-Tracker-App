using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// The signed-in user's own account: profile updates and deletion.
/// </summary>
[Authorize]
[Route("api/account")]
public class AccountController(AppDbContext db, INeonObjectStorage storage) : ApiControllerBase
{
    Guid U => CurrentUserId;

    /// <summary>
    /// Updates display name and profile photo.
    /// </summary>
    /// <param name="r">
    /// <c>ProfileImageUrl</c>: a <c>data:image/...</c> URL uploads a new photo (max 1 MB),
    /// an empty value removes it, and an existing storage key keeps it.
    /// </param>
    /// <response code="200">The updated user.</response>
    /// <response code="400">Invalid name or image.</response>
    [HttpPut("profile")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(ProfileUpdateRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.DisplayName) || r.DisplayName.Trim().Length > 80)
            return BadRequest(new { message = "Display name is required and must be 80 characters or fewer." });
        var u = await db.Users.FindAsync(U);
        if (u is null)
            return NotFound();
        var old = u.ProfileImageUrl;
        if (!string.IsNullOrWhiteSpace(r.ProfileImageUrl) && r.ProfileImageUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            u.ProfileImageUrl = await storage.PutDataUrlAsync("users", $"{U}/{Guid.NewGuid():N}", r.ProfileImageUrl);
        else if (string.IsNullOrWhiteSpace(r.ProfileImageUrl))
            u.ProfileImageUrl = null;
        else if (!r.ProfileImageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            u.ProfileImageUrl = r.ProfileImageUrl.Trim();
        if (u.ProfileImageUrl != old && !string.IsNullOrWhiteSpace(old))
            await storage.DeleteAsync("users", old);
        await db.SaveChangesAsync();
        return Ok(new { u.Id, u.Email, u.DisplayName, u.TimeZoneId, ProfileImageUrl = string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? null : storage.GetReadUrl("users", u.ProfileImageUrl) });
    }

    /// <summary>
    /// Permanently deletes the account.
    /// </summary>
    /// <remarks>
    /// Patients are transferred to another approved family caregiver when one exists; otherwise
    /// they and their medicines/doses are deleted. Refused while doses are pending for a patient
    /// that would be deleted. Families owned by the user pass to another member or are removed.
    /// </remarks>
    /// <response code="200">Account deleted.</response>
    /// <response code="409">Pending doses would be lost.</response>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = U;
        var owned = await db.Patients.Where(p => p.UserId == userId).ToListAsync();
        var patientIds = owned.Select(p => p.Id).ToList();
        var hasPending = patientIds.Count > 0 && await db.DoseEvents.AnyAsync(d => patientIds.Contains(d.PatientId) && d.Status == "pending");
        var familyIds = await db.FamilyMembers.Where(m => m.UserId == userId && m.Status == "approved").Select(m => m.FamilyId).ToListAsync();
        var replacementByPatient = new Dictionary<Guid, Guid>();
        foreach (var patient in owned)
        {
            var replacement = await db.FamilyMembers.Where(m => familyIds.Contains(m.FamilyId) && m.UserId != userId && m.Status == "approved").OrderBy(m => m.CreatedAt).Select(m => (Guid?)m.UserId).FirstOrDefaultAsync();
            if (replacement.HasValue)
                replacementByPatient[patient.Id] = replacement.Value;
        }

        if (hasPending && replacementByPatient.Count != owned.Count)
            return Conflict(new { message = "Your account cannot be deleted while doses are still pending. Add another approved family caregiver for every patient you manage, or resolve all pending doses first." });
        var retained = new HashSet<Guid>();
        foreach (var patient in owned)
        {
            if (replacementByPatient.TryGetValue(patient.Id, out var replacement))
            {
                patient.UserId = replacement;
                retained.Add(patient.Id);
            }
        }

        var removeIds = patientIds.Where(id => !retained.Contains(id)).ToList();
        if (removeIds.Count > 0)
        {
            db.DoseEvents.RemoveRange(db.DoseEvents.Where(d => removeIds.Contains(d.PatientId)));
            db.Medicines.RemoveRange(db.Medicines.Where(m => removeIds.Contains(m.PatientId)));
            db.Patients.RemoveRange(owned.Where(p => removeIds.Contains(p.Id)));
        }

        foreach (var family in await db.Families.Where(f => f.OwnerUserId == userId).ToListAsync())
        {
            var other = await db.FamilyMembers.Where(m => m.FamilyId == family.Id && m.UserId != userId && m.Status == "approved").Select(m => (Guid?)m.UserId).FirstOrDefaultAsync();
            if (other.HasValue)
                family.OwnerUserId = other.Value;
            else
            {
                db.FamilyInvites.RemoveRange(db.FamilyInvites.Where(i => i.FamilyId == family.Id));
                db.FamilyMembers.RemoveRange(db.FamilyMembers.Where(m => m.FamilyId == family.Id));
                db.Families.Remove(family);
            }
        }

        db.FamilyInvites.RemoveRange(db.FamilyInvites.Where(i => i.InviterUserId == userId || i.InviteeUserId == userId));
        db.FamilyMembers.RemoveRange(db.FamilyMembers.Where(m => m.UserId == userId));
        db.Notifications.RemoveRange(db.Notifications.Where(n => n.UserId == userId));
        db.PushSubscriptions.RemoveRange(db.PushSubscriptions.Where(s => s.UserId == userId));
        db.NotificationDeliveries.RemoveRange(db.NotificationDeliveries.Where(d => d.UserId == userId));
        db.PasswordResetTokens.RemoveRange(db.PasswordResetTokens.Where(t => t.UserId == userId));
        var user = await db.Users.FindAsync(userId);
        if (user is not null)
        {
            if (!string.IsNullOrWhiteSpace(user.ProfileImageUrl))
                await storage.DeleteAsync("users", user.ProfileImageUrl);
            db.Users.Remove(user);
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Account deleted successfully." });
    }
}
