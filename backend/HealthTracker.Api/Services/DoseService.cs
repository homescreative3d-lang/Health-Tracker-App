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

    /// <summary>
    /// Moves one dose to another date/time: the original is marked <c>rescheduled</c> and a new
    /// pending dose is created at the target, linked back to it, and the care team is notified.
    /// </summary>
    /// <param name="userId">Signed-in user.</param>
    /// <param name="id">Dose to move.</param>
    /// <param name="date">Target date (owner's time zone).</param>
    /// <param name="time">Target time <c>HH:mm</c>; null keeps the original time.</param>
    /// <param name="reason">Why it was moved (required; recorded in the audit trail).</param>
    /// <exception cref="InvalidOperationException">Dose already taken/skipped/moved, target in the past, or slot taken.</exception>
    /// <returns>The newly created dose.</returns>
    Task<DoseResponse> Reschedule(Guid userId, Guid id, DateOnly date, string? time = null, string? reason = null);

    /// <summary>
    /// Stores a future scheduled dose so it can be acted on (e.g. rescheduled). Future doses are
    /// otherwise computed on the fly and never written to the database.
    /// </summary>
    /// <exception cref="InvalidOperationException">The medicine isn't scheduled at that date/time.</exception>
    Task<DoseResponse> Materialize(Guid userId, Guid medicineId, DateOnly date, string time);

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
/// <param name="notifier">Care-team notifications (optional so unit tests can omit it).</param>
/// <param name="audit">Audit trail (optional so unit tests can omit it).</param>
/// <param name="windowSettings">Action window length (optional; defaults to 12 hours).</param>
public class DoseService(AppDbContext db, IPatientAccessService access, ICareTeamNotifier? notifier = null, IAuditTrail? audit = null, DoseWindowSettings? windowSettings = null) : IDoseService
{
    /// <inheritdoc />
    public async Task<List<DoseResponse>> Get(Guid uid, DateOnly date, Guid? patientId)
    {
        currentWindow = await Window();
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
                        Id = VirtualId(p.Id, m.Id, date, time),
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

        // Doses moved INTO this date by a reschedule aren't on the regular schedule, so add them explicitly.
        foreach (var moved in events.Where(x => x.RescheduledFromId.HasValue))
        {
            if (result.Any(x => x.Id == moved.Id))
                continue;
            var medicine = meds.SingleOrDefault(x => x.Id == moved.MedicineId);
            if (medicine is null)
                continue;
            if (date == DoseSchedule.LocalToday(tz))
                ApplyCurrentState(moved, tz);
            result.Add(Map(moved, medicine, p));
        }

        foreach (var acted in events.Where(x => x.Status is "taken" or "skipped" or "rescheduled"))
        {
            if (result.Any(x => x.Id == acted.Id))
                continue;
            var medicine = meds.SingleOrDefault(x => x.Id == acted.MedicineId);
            if (medicine is not null)
                result.Add(Map(acted, medicine, p));
        }

        // Future days are computed on the fly and never stored: rows are created only up to today
        // (needed for reminders and actions). A future dose is stored when someone acts on it (Materialize).
        var isFuture = date > DoseSchedule.LocalToday(tz);
        if (missing.Count > 0 && !isFuture)
            db.DoseEvents.AddRange(missing);
        await db.SaveChangesAsync();
        // Name who took/skipped each dose so shared caregivers can see it (was always null).
        var actorIds = result.Where(x => x.ActionedByUserId.HasValue).Select(x => x.ActionedByUserId!.Value).Distinct().ToList();
        var actorNames = actorIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.Users.Where(u => actorIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName);
        // Where each moved-in dose originally came from (for the "Rescheduled from …" badge).
        var originIds = result.Where(x => x.RescheduledFromId.HasValue).Select(x => x.RescheduledFromId!.Value).ToList();
        var origins = originIds.Count == 0
            ? new Dictionary<Guid, DoseEvent>()
            : await db.DoseEvents.Where(e => originIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e);
        // One card per dose per day: a dose moved to another time on the SAME day is represented by
        // the moved dose (which carries the change history), not by a second "moved" card.
        var dayString = date.ToString("yyyy-MM-dd");
        result = result.Where(x => !(x.Status == "rescheduled" && x.RescheduleTo == dayString)).ToList();

        // Change history per card: its own audit entries plus those of the dose it was moved from.
        var historyIds = result.Select(x => x.Id).Concat(result.Where(x => x.RescheduledFromId.HasValue).Select(x => x.RescheduledFromId!.Value)).ToList();
        var auditRows = await db.AuditLogs.Where(a => a.EntityType == "dose" && historyIds.Contains(a.EntityId)).ToListAsync();
        List<AuditEntryResponse> HistoryFor(DoseResponse d) => auditRows
            .Where(a => a.EntityId == d.Id || (d.RescheduledFromId.HasValue && a.EntityId == d.RescheduledFromId.Value))
            .OrderBy(a => a.At).Select(IAuditTrail.Map).ToList();

        var virtualIds = isFuture ? missing.Select(x => x.Id).ToHashSet() : [];
        return result
            .Select(x => x with { History = HistoryFor(x), IsVirtual = virtualIds.Contains(x.Id) })
            .Select(x => x.ActionedByUserId is Guid actor && actorNames.TryGetValue(actor, out var name) ? x with { ActionedByName = name } : x)
            .Select(x => x.RescheduledFromId is Guid from && origins.TryGetValue(from, out var o)
                ? x with { RescheduledFromDate = o.Date.ToString("yyyy-MM-dd"), RescheduledFromTime = o.Time }
                : x)
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
        var window = await Window();
        if (now > scheduled + window)
            throw new InvalidOperationException($"This dose can no longer be marked: doses can be recorded up to {Hours(window)} after their scheduled time.");
        var (perDose, unit) = DoseQuantity.Parse(x.Medicine.DoseAmount, x.Medicine.Form);
        if (x.Medicine.StockQuantity < perDose)
            throw new InvalidOperationException($"Not enough {x.Medicine.Name} left ({DoseQuantity.Format(x.Medicine.StockQuantity, unit)}). Record a refill first.");
        if (x.Dose.Status == "taken")
            return Map(x.Dose, x.Medicine, x.Patient);
        x.Dose.Status = "taken";
        x.Dose.TakenAt = now;
        x.Dose.ActionedByUserId = uid;
        x.Medicine.StockQuantity -= perDose;
        StockPlanner.SyncDoses(x.Medicine);
        await Audit(uid, x.Dose, x.Medicine, "taken", $"{x.Medicine.Name} taken ({Slot(x.Dose.Date, x.Dose.Time)})");
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
        var window = await Window();
        if (now > scheduled + window)
            throw new InvalidOperationException($"This dose can no longer be changed: doses can be recorded up to {Hours(window)} after their scheduled time.");
        x.Dose.Status = "skipped";
        x.Dose.SkipReason = string.IsNullOrWhiteSpace(reason) ? "Skipped by user" : reason.Trim();
        x.Dose.ActionedByUserId = uid;
        await Audit(uid, x.Dose, x.Medicine, "skipped", $"{x.Medicine.Name} skipped ({Slot(x.Dose.Date, x.Dose.Time)})", x.Dose.SkipReason);
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Reschedule(Guid uid, Guid id, DateOnly date, string? time = null, string? reason = null)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 3)
            throw new InvalidOperationException("Add a short reason for rescheduling.");
        var x = await Event(uid, id);
        if (x.Dose.Status is "taken" or "skipped")
            throw new InvalidOperationException("This dose was already recorded. Undo it first to reschedule.");
        if (x.Dose.Status == "rescheduled")
            throw new InvalidOperationException("This dose has already been rescheduled.");
        var targetTime = string.IsNullOrWhiteSpace(time) ? x.Dose.Time : time.Trim();
        if (!TimeOnly.TryParseExact(targetTime, "HH:mm", out _))
            throw new InvalidOperationException("Choose a valid time.");
        var zone = Zone(x.OwnerTimeZone);
        if (DoseSchedule.ScheduledAt(date, targetTime, zone) <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Choose a time later than now.");
        if (date == x.Dose.Date && targetTime == x.Dose.Time)
            throw new InvalidOperationException("Pick a different date or time.");
        if (await db.DoseEvents.AnyAsync(e => e.PatientId == x.Patient.Id && e.MedicineId == x.Medicine.Id && e.Date == date && e.Time == targetTime))
            throw new InvalidOperationException("This medicine already has a dose at that date and time.");

        x.Dose.Status = "rescheduled";
        x.Dose.RescheduleTo = date;
        x.Dose.RescheduleToTime = targetTime;
        x.Dose.ActionedByUserId = uid;
        var moved = new DoseEvent
        {
            PatientId = x.Patient.Id,
            MedicineId = x.Medicine.Id,
            Date = date,
            Time = targetTime,
            RescheduledFromId = x.Dose.Id
        };
        db.DoseEvents.Add(moved);
        var summary = $"Moved from {Slot(x.Dose.Date, x.Dose.Time)} to {Slot(date, targetTime)}";
        await Audit(uid, x.Dose, x.Medicine, "rescheduled", summary, reason,
            new { fromDate = x.Dose.Date.ToString("yyyy-MM-dd"), fromTime = x.Dose.Time, toDate = date.ToString("yyyy-MM-dd"), toTime = targetTime, newDoseId = moved.Id });
        await db.SaveChangesAsync();

        if (notifier is not null)
        {
            var when = $"{date:ddd d MMM} at {TimeOnly.ParseExact(targetTime, "HH:mm"):h:mm tt}";
            await notifier.NotifyAsync(x.Patient, "dose_rescheduled", "Dose rescheduled",
                $"{x.Medicine.Name} ({x.Medicine.Strength}) for {x.Patient.Name} was moved to {when}.",
                new { doseId = moved.Id, originalDoseId = x.Dose.Id, patientId = x.Patient.Id, patientName = x.Patient.Name, medicineName = x.Medicine.Name, date = date.ToString("yyyy-MM-dd"), time = targetTime });
        }

        return Map(moved, x.Medicine, x.Patient) with
        {
            RescheduledFromDate = x.Dose.Date.ToString("yyyy-MM-dd"),
            RescheduledFromTime = x.Dose.Time
        };
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Undo(Guid uid, Guid id)
    {
        var x = await Event(uid, id);
        var now = DateTimeOffset.UtcNow;
        var scheduled = ScheduledAt(x.Dose, Zone(x.OwnerTimeZone));
        // Reschedules can be undone any time the moved dose is still open; take/skip only within the window.
        var window = await Window();
        if (x.Dose.Status != "rescheduled" && now > scheduled + window)
            throw new InvalidOperationException($"This dose can no longer be changed: doses can be recorded up to {Hours(window)} after their scheduled time.");
        var previous = x.Dose.Status;
        // Undoing a reschedule removes the moved dose (only while it hasn't been actioned).
        if (x.Dose.Status == "rescheduled")
        {
            var moved = await db.DoseEvents.FirstOrDefaultAsync(e => e.RescheduledFromId == x.Dose.Id);
            if (moved is not null && (moved.Status is "taken" or "skipped"))
                throw new InvalidOperationException("The rescheduled dose was already recorded, so this can't be undone.");
            if (moved is not null)
                db.DoseEvents.Remove(moved);
            x.Dose.RescheduleToTime = null;
        }

        // Take decrements supply; undoing a taken dose must give it back (previously it didn't,
        // so supply counts and refill reminders drifted after every undo).
        if (x.Dose.Status == "taken")
        {
            x.Medicine.StockQuantity += DoseQuantity.Parse(x.Medicine.DoseAmount, x.Medicine.Form).PerDose;
            StockPlanner.SyncDoses(x.Medicine);
        }
        x.Dose.Status = "pending";
        x.Dose.TakenAt = null;
        x.Dose.SkipReason = null;
        x.Dose.RescheduleTo = null;
        x.Dose.MissedAt = null;
        x.Dose.ActionedByUserId = uid;
        await Audit(uid, x.Dose, x.Medicine, "undone", $"{x.Medicine.Name} reset to pending ({Slot(x.Dose.Date, x.Dose.Time)}); was {previous}");
        await db.SaveChangesAsync();
        return Map(x.Dose, x.Medicine, x.Patient);
    }

    /// <inheritdoc />
    public async Task<DoseResponse> Materialize(Guid uid, Guid medicineId, DateOnly date, string time)
    {
        var m = await db.Medicines.FindAsync(medicineId) ?? throw new KeyNotFoundException("Medicine not found.");
        var p = await access.GetAccessiblePatientAsync(uid, m.PatientId);
        var existing = await db.DoseEvents.FirstOrDefaultAsync(e => e.PatientId == p.Id && e.MedicineId == m.Id && e.Date == date && e.Time == time);
        if (existing is not null)
            return Map(existing, m, p);
        if (!DoseSchedule.Occurs(m, date) || !DoseSchedule.Times(m).Contains(time))
            throw new InvalidOperationException("This medicine isn't scheduled at that time.");
        var d = new DoseEvent { Id = VirtualId(p.Id, m.Id, date, time), PatientId = p.Id, MedicineId = m.Id, Date = date, Time = time };
        db.DoseEvents.Add(d);
        await db.SaveChangesAsync();
        return Map(d, m, p);
    }

    /// <summary>
    /// Deterministic id for a scheduled slot, so a virtual future dose keeps the same id when it is
    /// later stored (stable React keys, no duplicates).
    /// </summary>
    private static Guid VirtualId(Guid patientId, Guid medicineId, DateOnly date, string time)
    {
        var bytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes($"{patientId}|{medicineId}|{date:yyyy-MM-dd}|{time}"));
        return new Guid(bytes);
    }

    /// <summary>Formats a dose slot for audit summaries, e.g. "Fri 10 Oct, 8:00 AM".</summary>
    private static string Slot(DateOnly date, string time) =>
        $"{date:ddd d MMM}, {(TimeOnly.TryParseExact(time, "HH:mm", out var t) ? t.ToString("h:mm tt") : time)}";

    /// <summary>Window used by <see cref="ApplyCurrentState"/> (loaded at the start of <see cref="Get"/>).</summary>
    private TimeSpan currentWindow = DoseSchedule.ActionWindow;

    /// <summary>How long after its time a dose may still be marked (database setting, default 12 hours).</summary>
    private async Task<TimeSpan> Window() => windowSettings is null ? DoseWindowSettings.Default : await windowSettings.GetAsync();

    /// <summary>"12 hours" / "1 hour" for messages.</summary>
    private static string Hours(TimeSpan w) => w.TotalHours == 1 ? "1 hour" : $"{w.TotalHours:0.#} hours";

    /// <summary>Queues an audit entry for a dose action (no-op when auditing isn't wired, e.g. in tests).</summary>
    private Task Audit(Guid uid, DoseEvent d, Medicine m, string action, string summary, string? reason = null, object? details = null) =>
        audit?.RecordAsync(uid, "dose", d.Id, action, summary, d.PatientId, m.Id, reason, details) ?? Task.CompletedTask;

    /// <summary>Marks a pending dose as missed once its action window has closed (still recordable before that).</summary>
    void ApplyCurrentState(DoseEvent d, TimeZoneInfo tz)
    {
        if (d.Status == "pending" && DateTimeOffset.UtcNow > ScheduledAt(d, tz) + currentWindow)
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
        if (!await access.CanAccessPatientAsync(uid, p.Id))
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
    static DoseResponse Map(DoseEvent d, Medicine m, Patient p) => new(d.Id, m.Id, p.Id.ToString(), p.Name, m.Name, m.Strength, m.Form, m.Condition, d.Time, m.Liquid, m.WithFood, d.Status, d.TakenAt, d.SkipReason, d.RescheduleTo?.ToString("yyyy-MM-dd"), d.ActionedByUserId, null, d.RescheduleToTime, d.RescheduledFromId, null, null, d.Date.ToString("yyyy-MM-dd"), null, m.DoseAmount);
}
