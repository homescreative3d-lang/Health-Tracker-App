using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;
/// <summary>
/// Reads a patient's daily doses and records actions on them.
/// </summary>
public interface IDoseService
{
    /// <summary>
    /// Returns the doses scheduled on a date, materializing missing dose records.
    /// </summary>
    /// <param name="userId">Signed-in user.</param>
    /// <param name="date">Calendar date in the owner's time zone.</param>
    /// <param name="patientId">Patient, or null for the user's own first patient.</param>
    /// <exception cref="KeyNotFoundException">Patient not found.</exception>
    /// <exception cref="UnauthorizedAccessException">No access to the patient.</exception>
    Task<List<DoseResponse>> Get(Guid userId, DateOnly date, Guid? patientId);

    /// <summary>Marks a dose taken and decrements supply (within the action window).</summary>
    /// <exception cref="InvalidOperationException">Outside the window or no supply left.</exception>
    Task<DoseResponse> Take(Guid userId, Guid id);

    /// <summary>Marks a dose skipped with a reason (within the action window).</summary>
    /// <exception cref="InvalidOperationException">Outside the window.</exception>
    Task<DoseResponse> Skip(Guid userId, Guid id, string reason);

    /// <summary>Marks a dose rescheduled to another date.</summary>
    Task<DoseResponse> Reschedule(Guid userId, Guid id, DateOnly date);

    /// <summary>Reverts a dose to pending, restoring supply when it had been taken.</summary>
    /// <exception cref="InvalidOperationException">The window has closed.</exception>
    Task<DoseResponse> Undo(Guid userId, Guid id);
}

/// <summary>
/// EF Core implementation of <see cref="IDoseService"/>. Scheduling rules live in
/// <see cref="DoseSchedule"/>; access checks in <see cref="IPatientAccessService"/>.
/// </summary>
/// <param name="db">Pooled database context.</param>
/// <param name="access">Patient access rules.</param>
public class DoseService(AppDbContext db, IPatientAccessService access) : IDoseService
{
    /// <inheritdoc />
    public async Task<List<DoseResponse>> Get(Guid uid, DateOnly date, Guid? patientId)
    {
        var p = await access.GetAccessiblePatientAsync(uid, patientId);
        var owner = await db.Users.FindAsync(p.UserId);
        var tz = Zone(owner?.TimeZoneId);
        var meds = await db.Medicines.Where(x => x.PatientId == p.Id).ToListAsync();
        var medIds = meds.Select(x => x.Id).ToList();
        var events = await db.DoseEvents.Where(x => x.PatientId == p.Id && x.Date == date && medIds.Contains(x.MedicineId)).ToListAsync();
        var byKey = events.ToDictionary(x => $"{x.MedicineId}:{x.Time}");
        var missing = new List<DoseEvent>();
        var result = new List<DoseResponse>();
        foreach (var m in meds)
        {
            if (!DoseSchedule.Occurs(m, date))
                continue;
            foreach (var time in DoseSchedule.Times(m))
            {
                if (!byKey.TryGetValue($"{m.Id}:{time}", out var d))
                {
                    d = new DoseEvent
                    {
                        PatientId = p.Id,
                        MedicineId = m.Id,
                        Date = date,
                        Time = time
                    };
                    missing.Add(d);
                    byKey[$"{m.Id}:{time}"] = d;
                }

                if (date == DoseSchedule.LocalToday(tz))
                    ApplyCurrentState(d, tz);
                result.Add(Map(d, m, p));
            }
        }

        foreach (var acted in events.Where(x => x.Status is "taken" or "skipped" or "rescheduled"))
        {
            if (result.Any(x => x.Id == acted.Id))
                continue;
            var medicine = meds.SingleOrDefault(x => x.Id == acted.MedicineId);
            if (medicine is not null)
                result.Add(Map(acted, medicine, p));
        }

        if (missing.Count > 0)
            db.DoseEvents.AddRange(missing);
        await db.SaveChangesAsync();
        // Name who took/skipped each dose so shared caregivers can see it (was always null).
        var actorIds = result.Where(x => x.ActionedByUserId.HasValue).Select(x => x.ActionedByUserId!.Value).Distinct().ToList();
        var actorNames = actorIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName);
        return result
            .Select(x => x.ActionedByUserId is Guid actor && actorNames.TryGetValue(actor, out var name) ? x with { ActionedByName = name } : x)
            .OrderBy(x => x.Time)
            .ToList();
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Take(Guid uid, Guid id)
    {
        var x = await Event(uid, id);
        var now = DateTimeOffset.UtcNow;
        var scheduled = ScheduledAt(x.Dose, Zone(x.OwnerTimeZone));
        if (now < scheduled)
            throw new InvalidOperationException("This dose cannot be taken before its scheduled time.");
        if (now > scheduled.AddHours(1))
            throw new InvalidOperationException("This dose is locked. It can only be marked taken within 1 hour of the scheduled time.");
        if (x.Medicine.SupplyCount < 1)
            throw new InvalidOperationException("No supply remains for this medicine.");
        if (x.Dose.Status == "taken")
            return Map(x.Dose, x.Medicine, x.Patient);
        x.Dose.Status = "taken";
        x.Dose.TakenAt = now;
        x.Dose.ActionedByUserId = uid;
        x.Medicine.SupplyCount--;
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Skip(Guid uid, Guid id, string reason)
    {
        var x = await Event(uid, id);
        var now = DateTimeOffset.UtcNow;
        var scheduled = ScheduledAt(x.Dose, Zone(x.OwnerTimeZone));
        if (now < scheduled)
            throw new InvalidOperationException("This dose cannot be skipped before its scheduled time.");
        if (now > scheduled.AddHours(1))
            throw new InvalidOperationException("This dose is locked after 1 hour.");
        x.Dose.Status = "skipped";
        x.Dose.SkipReason = string.IsNullOrWhiteSpace(reason) ? "Skipped by user" : reason.Trim();
        x.Dose.ActionedByUserId = uid;
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Reschedule(Guid uid, Guid id, DateOnly date)
    {
        var x = await Event(uid, id);
        x.Dose.Status = "rescheduled";
        x.Dose.RescheduleTo = date;
        x.Dose.ActionedByUserId = uid;
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Undo(Guid uid, Guid id)
    {
        var x = await Event(uid, id);
        var now = DateTimeOffset.UtcNow;
        var scheduled = ScheduledAt(x.Dose, Zone(x.OwnerTimeZone));
        if (now > scheduled.AddHours(1))
            throw new InvalidOperationException("This dose is locked after 1 hour.");
        // Take decrements supply; undoing a taken dose must give it back (previously it didn't,
        // so supply counts and refill reminders drifted after every undo).
        if (x.Dose.Status == "taken")
            x.Medicine.SupplyCount++;
        x.Dose.Status = "pending";
        x.Dose.TakenAt = null;
        x.Dose.SkipReason = null;
        x.Dose.RescheduleTo = null;
        x.Dose.MissedAt = null;
        x.Dose.ActionedByUserId = uid;
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <summary>Marks a pending dose as missed once its scheduled time has passed.</summary>
    void ApplyCurrentState(DoseEvent d, TimeZoneInfo tz)
    {
        if (d.Status == "pending" && DateTimeOffset.UtcNow > ScheduledAt(d, tz))
        {
            d.Status = "missed";
            d.MissedAt ??= DateTimeOffset.UtcNow;
        }
    }

    /// <summary>
    /// Loads a dose with its medicine and patient after checking access, refreshing missed state.
    /// </summary>
    /// <param name="uid">Signed-in user.</param>
    /// <param name="id">Dose id.</param>
    async Task<(DoseEvent Dose, Medicine Medicine, Patient Patient, string OwnerTimeZone)> Event(Guid uid, Guid id)
    {
        var d = await db.DoseEvents.SingleOrDefaultAsync(x => x.Id == id) ?? throw new KeyNotFoundException("Dose not found.");
        var p = await db.Patients.SingleOrDefaultAsync(x => x.Id == d.PatientId) ?? throw new KeyNotFoundException("Patient not found.");
        if (!(await access.GetAccessibleOwnerIdsAsync(uid)).Contains(p.UserId))
            throw new UnauthorizedAccessException("You do not have access to this dose.");
        var m = await db.Medicines.SingleOrDefaultAsync(x => x.Id == d.MedicineId && x.PatientId == p.Id) ?? throw new KeyNotFoundException("Medicine not found.");
        var owner = await db.Users.FindAsync(p.UserId);
        var tz = owner?.TimeZoneId ?? DoseSchedule.DefaultTimeZoneId;
        if (d.Status == "pending" && DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Zone(tz)).DateTime) == d.Date && DateTimeOffset.UtcNow > ScheduledAt(d, Zone(tz)))
        {
            d.Status = "missed";
            d.MissedAt ??= DateTimeOffset.UtcNow;
        }

        return (d, m, p, tz);
    }

    /// <summary>Absolute scheduled instant of a dose.</summary>
    static DateTimeOffset ScheduledAt(DoseEvent d, TimeZoneInfo tz) => DoseSchedule.ScheduledAt(d.Date, d.Time, tz);

    /// <summary>Resolves a time zone with the default fallback.</summary>
    static TimeZoneInfo Zone(string? id) => DoseSchedule.ResolveTimeZone(id);

    /// <summary>Maps a dose record to its API response.</summary>
    static DoseResponse Map(DoseEvent d, Medicine m, Patient p) => new(d.Id, m.Id, p.Id.ToString(), p.Name, m.Name, m.Strength, m.Form, m.Condition, d.Time, m.Liquid, m.WithFood, d.Status, d.TakenAt, d.SkipReason, d.RescheduleTo?.ToString("yyyy-MM-dd"), d.ActionedByUserId, null);
}
