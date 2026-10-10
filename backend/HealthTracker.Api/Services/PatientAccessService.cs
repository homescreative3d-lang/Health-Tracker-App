using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>
/// Answers "which patients may this user see and edit?".
/// </summary>
/// <remarks>
/// Rule: a user can access patients they own, plus patients owned by any approved member of a
/// family the user is an approved member of. This query was previously copy-pasted into six
/// controllers/services.
/// </remarks>
public interface IPatientAccessService
{
    /// <summary>
    /// Returns the ids of users whose patients <paramref name="userId"/> can access (always includes the user).
    /// </summary>
    /// <param name="userId">The signed-in user.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<HashSet<Guid>> GetAccessibleOwnerIdsAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Returns whether the user can access a patient.
    /// </summary>
    /// <param name="userId">The signed-in user.</param>
    /// <param name="patientId">The patient.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<bool> CanAccessPatientAsync(Guid userId, Guid patientId, CancellationToken ct = default);

    /// <summary>
    /// Loads a patient the user can access.
    /// </summary>
    /// <param name="userId">The signed-in user.</param>
    /// <param name="patientId">A specific patient, or <c>null</c> for the user's first own patient.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="KeyNotFoundException">The patient doesn't exist (mapped to 404).</exception>
    /// <exception cref="UnauthorizedAccessException">The user can't access it (mapped to 403).</exception>
    Task<Patient> GetAccessiblePatientAsync(Guid userId, Guid? patientId, CancellationToken ct = default);
}

/// <summary>
/// EF Core implementation of <see cref="IPatientAccessService"/>.
/// </summary>
/// <param name="db">Pooled database context.</param>
public sealed class PatientAccessService(AppDbContext db) : IPatientAccessService
{
    /// <inheritdoc />
    public async Task<HashSet<Guid>> GetAccessibleOwnerIdsAsync(Guid userId, CancellationToken ct = default)
    {
        var ids = await db.FamilyMembers
            .Where(member => member.UserId == userId && member.Status == "approved")
            .Join(db.FamilyMembers.Where(other => other.Status == "approved"),
                member => member.FamilyId, other => other.FamilyId, (_, other) => other.UserId)
            .Distinct()
            .ToListAsync(ct);
        var set = ids.ToHashSet();
        set.Add(userId);
        return set;
    }

    /// <inheritdoc />
    public async Task<bool> CanAccessPatientAsync(Guid userId, Guid patientId, CancellationToken ct = default)
    {
        var ownerId = await db.Patients.Where(p => p.Id == patientId).Select(p => (Guid?)p.UserId).FirstOrDefaultAsync(ct);
        if (ownerId is null)
            return false;
        return ownerId == userId || (await GetAccessibleOwnerIdsAsync(userId, ct)).Contains(ownerId.Value);
    }

    /// <inheritdoc />
    public async Task<Patient> GetAccessiblePatientAsync(Guid userId, Guid? patientId, CancellationToken ct = default)
    {
        if (!patientId.HasValue)
        {
            // FirstOrDefault (not Single): users commonly own several patients (self + cared-for),
            // and SingleOrDefault threw a 500 for them.
            return await db.Patients.Where(p => p.UserId == userId).FirstOrDefaultAsync(ct)
                ?? throw new KeyNotFoundException("Patient not found.");
        }

        var patient = await db.Patients.FirstOrDefaultAsync(p => p.Id == patientId.Value, ct)
            ?? throw new KeyNotFoundException("Patient not found.");
        var owners = await GetAccessibleOwnerIdsAsync(userId, ct);
        return owners.Contains(patient.UserId)
            ? patient
            : throw new UnauthorizedAccessException("You do not have access to this patient.");
    }
}
