using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>Writes and reads the audit trail.</summary>
public interface IAuditTrail
{
    /// <summary>
    /// Queues an audit entry on the current context; it is saved with the caller's SaveChanges,
    /// so the action and its audit record commit together.
    /// </summary>
    /// <param name="actorUserId">Who did it.</param>
    /// <param name="entityType"><c>dose</c> or <c>medicine</c>.</param>
    /// <param name="entityId">Affected entity.</param>
    /// <param name="action">Action code.</param>
    /// <param name="summary">Human-readable summary.</param>
    /// <param name="patientId">Patient concerned.</param>
    /// <param name="medicineId">Medicine concerned.</param>
    /// <param name="reason">Why (required for reschedules and pauses).</param>
    /// <param name="details">Before/after values.</param>
    Task RecordAsync(Guid actorUserId, string entityType, Guid entityId, string action, string summary, Guid? patientId, Guid? medicineId, string? reason = null, object? details = null);

    /// <summary>Maps an entity to its API shape.</summary>
    static AuditEntryResponse Map(AuditLog a) => new(a.Id, a.EntityType, a.EntityId, a.MedicineId, a.PatientId, a.Action, a.ActorName, a.Reason, a.Summary, a.At);
}

/// <summary>EF Core implementation of <see cref="IAuditTrail"/>.</summary>
/// <param name="db">Pooled database context (shared with the caller's unit of work).</param>
public sealed class AuditTrail(AppDbContext db) : IAuditTrail
{
    /// <inheritdoc />
    public async Task RecordAsync(Guid actorUserId, string entityType, Guid entityId, string action, string summary, Guid? patientId, Guid? medicineId, string? reason = null, object? details = null)
    {
        var name = await db.Users.Where(u => u.Id == actorUserId).Select(u => u.DisplayName).FirstOrDefaultAsync() ?? "Someone";
        db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            ActorName = name,
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            Summary = summary,
            PatientId = patientId,
            MedicineId = medicineId,
            Reason = (reason ?? "").Trim(),
            DetailsJson = details is null ? "{}" : JsonSerializer.Serialize(details)
        });
    }
}
