using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// A patient's medicines (the schedule definitions that doses are generated from).
/// </summary>
/// <remarks>
/// All endpoints take an optional <c>patientId</c> query parameter; without it the user's own
/// first patient is used. Access is shared with approved family members.
/// </remarks>
[Authorize]
[Route("api/medicines")]
public class MedicinesController(AppDbContext db, IPatientAccessService access, IAuditTrail audit) : ApiControllerBase
{

    /// <summary>
    /// Lists a patient's medicines, including paused ones.
    /// </summary>
    /// <param name="patientId">Patient (optional).</param>
    /// <response code="200">Medicines.</response>
    /// <response code="403">No access to the patient.</response>
    [HttpGet]
    [ProducesResponseType<IEnumerable<MedicineResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Get([FromQuery] Guid? patientId)
    {
        var p = await P(patientId);
        var meds = await db.Medicines.Where(x => x.PatientId == p.Id).ToListAsync();
        var proj = await Projections(p, meds, 1);
        var refills = await LastRefills(meds.Select(m => m.Id).ToList());
        return Ok(meds.Select(m => Map(m, p, proj[m.Id], refills.GetValueOrDefault(m.Id))));
    }

    /// <summary>
    /// Adds a medicine to a patient's plan.
    /// </summary>
    /// <param name="r">Medicine definition. <c>Times</c> are <c>HH:mm</c>; <c>StartDate</c> is <c>YYYY-MM-DD</c>.</param>
    /// <param name="patientId">Patient (optional).</param>
    /// <response code="200">The created medicine.</response>
    /// <response code="400">Validation failed (previously some failures returned 500).</response>
    /// <response code="403">No access to the patient.</response>
    [HttpPost]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Post(MedicineRequest r, [FromQuery] Guid? patientId)
    {
        var p = await P(patientId);
        if (!r.IsRecurring && r.RefillThreshold != 0)
            return BadRequest(new { message = "Refill threshold must be disabled for non-recurring medicines." });
        var m = new Medicine
        {
            PatientId = p.Id
        };
        Apply(m, r);
        var (perDose, unit) = DoseQuantity.Parse(m.DoseAmount, m.Form);
        var qty = r.StockQuantity ?? r.SupplyCount * perDose;
        if (qty <= 0)
            return BadRequestMessage($"Enter how many {unit}s you have (more than 0).");
        m.StockUnit = unit;
        m.StockQuantity = qty;
        m.LastRefillAt = DateTimeOffset.UtcNow;
        StockPlanner.SyncDoses(m);
        db.Medicines.Add(m);
        db.RefillLogs.Add(new RefillLog { MedicineId = m.Id, PatientId = p.Id, Kind = "initial", Quantity = qty, Unit = unit, StockAfter = qty, ActorUserId = CurrentUserId, ActorName = await ActorName(), Note = "First fill" });
        await audit.RecordAsync(CurrentUserId, "medicine", m.Id, "created", $"{m.Name} {m.Strength} added to the plan with {DoseQuantity.Format(qty, unit)}", p.Id, m.Id);
        await db.SaveChangesAsync();
        return Ok(await MapOne(m, p));
    }

    /// <summary>
    /// Updates a medicine. Already-recorded doses keep their history.
    /// </summary>
    /// <param name="id">Medicine id.</param>
    /// <param name="r">Medicine definition.</param>
    /// <param name="patientId">Patient (optional).</param>
    /// <response code="200">The updated medicine.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Medicine not found for this patient.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Put(Guid id, MedicineRequest r, [FromQuery] Guid? patientId)
    {
        var p = await P(patientId);
        var m = await db.Medicines.SingleOrDefaultAsync(x => x.Id == id && x.PatientId == p.Id);
        if (m is null)
            return NotFound();
        if (!r.IsRecurring && r.RefillThreshold != 0)
            return BadRequest(new { message = "Refill threshold must be disabled for non-recurring medicines." });
        var before = new { m.Name, m.Strength, m.Form, m.TimesJson, m.FrequencyPattern, m.SupplyCount, m.DoseAmount };
        Apply(m, r);
        var (_, unit) = DoseQuantity.Parse(m.DoseAmount, m.Form);
        m.StockUnit = unit;
        if (r.StockQuantity is decimal qty && qty != m.StockQuantity)
        {
            if (qty < 0)
                return BadRequestMessage("Stock can't be negative.");
            db.RefillLogs.Add(new RefillLog { MedicineId = m.Id, PatientId = p.Id, Kind = "adjustment", Quantity = qty - m.StockQuantity, Unit = unit, StockAfter = qty, ActorUserId = CurrentUserId, ActorName = await ActorName(), Note = "Corrected while editing" });
            m.StockQuantity = qty;
        }

        StockPlanner.SyncDoses(m);
        await audit.RecordAsync(CurrentUserId, "medicine", m.Id, "updated", $"{m.Name} details edited", p.Id, m.Id, null,
            new { before, after = new { m.Name, m.Strength, m.Form, m.TimesJson, m.FrequencyPattern, m.SupplyCount, m.DoseAmount } });
        await db.SaveChangesAsync();
        return Ok(await MapOne(m, p));
    }

    /// <summary>
    /// Removes a medicine from the plan.
    /// </summary>
    /// <param name="id">Medicine id.</param>
    /// <param name="patientId">Patient (optional).</param>
    /// <response code="204">Deleted.</response>
    /// <response code="404">Medicine not found for this patient.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] Guid? patientId)
    {
        var p = await P(patientId);
        var m = await db.Medicines.SingleOrDefaultAsync(x => x.Id == id && x.PatientId == p.Id);
        if (m is null)
            return NotFound();
        db.Medicines.Remove(m);
        await audit.RecordAsync(CurrentUserId, "medicine", m.Id, "deleted", $"{m.Name} {m.Strength} removed from the plan", p.Id, m.Id);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>
    /// Full change history of a medicine across all its rescheduled versions: schedule changes,
    /// pauses, edits and every dose action (who, when, why).
    /// </summary>
    /// <param name="id">Any version of the medicine.</param>
    /// <response code="200">Audit entries, newest first.</response>
    /// <response code="404">Medicine not found or not accessible.</response>
    [HttpGet("{id:guid}/history")]
    [RequiresFeature("change_history")]
    [ProducesResponseType<List<AuditEntryResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> History(Guid id)
    {
        var m = await db.Medicines.FindAsync(id);
        if (m is null || !await access.CanAccessPatientAsync(CurrentUserId, m.PatientId))
            return NotFound();
        var ids = await Lineage(m);
        var rows = await db.AuditLogs.Where(a => a.MedicineId != null && ids.Contains(a.MedicineId.Value)).OrderByDescending(a => a.At).Take(300).ToListAsync();
        return Ok(rows.Select(IAuditTrail.Map));
    }

    /// <summary>Loads the requested patient after checking access.</summary>
    /// <param name="patientId">Patient, or null for the user's own first patient.</param>
    Task<Patient> P(Guid? patientId) => access.GetAccessiblePatientAsync(CurrentUserId, patientId);

    /// <summary>Maps an entity to its API response.</summary>
    static MedicineResponse Map(Medicine m, Patient p, StockProjection? sp = null, DateTimeOffset? lastRefill = null) => new(m.Id, p.Id.ToString(), p.Name, m.Name, m.Strength, m.Form, m.Condition, m.FrequencyPattern, JsonSerializer.Deserialize<List<string>>(m.SpecificDaysJson) ?? [], m.CycleEvery, m.CycleUnit, JsonSerializer.Deserialize<List<string>>(m.TimesJson) ?? [], m.Liquid, m.WithFood, m.StartDate.ToString("yyyy-MM-dd"), m.DurationType, m.DurationValue, m.DurationUnit, m.SupplyCount, m.RefillThreshold, m.IsRecurring, m.PauseStartDate?.ToString("yyyy-MM-dd"), m.PauseEndDate?.ToString("yyyy-MM-dd"), m.EndedOn?.ToString("yyyy-MM-dd"), m.RescheduledFromId, string.IsNullOrWhiteSpace(m.PreviousTimesJson) ? null : JsonSerializer.Deserialize<List<string>>(m.PreviousTimesJson), m.DoseAmount,
        m.StockQuantity, m.StockUnit, sp?.PerDose ?? 1, sp?.DaysLeft, sp?.RunOutDate?.ToString("yyyy-MM-dd"), sp?.Status ?? "ok", m.PrescribedBy, lastRefill ?? m.LastRefillAt);

    /// <summary>Maps one medicine with its live stock projection.</summary>
    async Task<MedicineResponse> MapOne(Medicine m, Patient p)
    {
        var proj = await Projections(p, [m], 1);
        var last = await LastRefills([m.Id]);
        return Map(m, p, proj[m.Id], last.GetValueOrDefault(m.Id));
    }

    /// <summary>Display name of the caller (stored on refill entries).</summary>
    async Task<string> ActorName() => await db.Users.Where(u => u.Id == CurrentUserId).Select(u => u.DisplayName).FirstOrDefaultAsync() ?? "Someone";

    /// <summary>Latest fill date per medicine (from the refill trail).</summary>
    async Task<Dictionary<Guid, DateTimeOffset>> LastRefills(List<Guid> ids) =>
        (await db.RefillLogs.Where(r => ids.Contains(r.MedicineId) && r.Kind != "adjustment").ToListAsync())
            .GroupBy(r => r.MedicineId).ToDictionary(g => g.Key, g => g.Max(r => r.At));

    /// <summary>
    /// Stock projections for a patient's medicines over <paramref name="days"/> days, using the
    /// owner's time zone and excluding doses already recorded today.
    /// </summary>
    async Task<Dictionary<Guid, StockProjection>> Projections(Patient p, List<Medicine> meds, int days)
    {
        var owner = await db.Users.FindAsync(p.UserId);
        var today = DoseSchedule.LocalToday(DoseSchedule.ResolveTimeZone(owner?.TimeZoneId));
        var ids = meds.Select(m => m.Id).ToList();
        var doneToday = (await db.DoseEvents.Where(e => ids.Contains(e.MedicineId) && e.Date == today && (e.Status == "taken" || e.Status == "skipped" || e.Status == "rescheduled")).ToListAsync())
            .GroupBy(e => e.MedicineId).ToDictionary(g => g.Key, g => g.Count());
        return meds.ToDictionary(m => m.Id, m =>
        {
            var remainingToday = Math.Max(0, DoseSchedule.Times(m).Count - doneToday.GetValueOrDefault(m.Id));
            return StockPlanner.Project(m, today, remainingToday, days);
        });
    }

    /// <summary>All versions of a medicine (follows reschedule links both ways).</summary>
    async Task<HashSet<Guid>> Lineage(Medicine m)
    {
        var ids = new HashSet<Guid> { m.Id };
        var cursor = m;
        while (cursor?.RescheduledFromId is Guid prev && ids.Add(prev))
            cursor = await db.Medicines.FindAsync(prev);
        var frontier = new List<Guid> { m.Id };
        while (frontier.Count > 0)
        {
            var next = await db.Medicines.Where(x => x.RescheduledFromId != null && frontier.Contains(x.RescheduledFromId.Value)).Select(x => x.Id).ToListAsync();
            frontier = next.Where(ids.Add).ToList();
        }

        return ids;
    }

    /// <summary>
    /// The stock trail of a medicine since its first fill (initial fill, refills, adjustments),
    /// across all its rescheduled versions, oldest first.
    /// </summary>
    /// <param name="id">Any version of the medicine.</param>
    /// <response code="200">Refill entries.</response>
    /// <response code="404">Medicine not found or not accessible.</response>
    [HttpGet("{id:guid}/refills")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Refills(Guid id)
    {
        var m = await db.Medicines.FindAsync(id);
        if (m is null || !await access.CanAccessPatientAsync(CurrentUserId, m.PatientId))
            return NotFound();
        var ids = await Lineage(m);
        var rows = await db.RefillLogs.Where(r => ids.Contains(r.MedicineId)).OrderBy(r => r.At).ToListAsync();
        return Ok(rows.Select(r => new { r.Id, r.Kind, r.Quantity, r.Unit, r.StockAfter, r.Pharmacy, r.Note, r.ActorName, r.At }));
    }

    /// <summary>
    /// Stock planner: for each active medicine of a patient, how long stock lasts and what is
    /// needed for the next <paramref name="days"/> days (schedule, dose amount, pauses and course
    /// end are all taken into account).
    /// </summary>
    /// <param name="patientId">Patient.</param>
    /// <param name="days">Window in days (1–365).</param>
    /// <response code="200">One row per active medicine; <c>insufficient</c> marks those that won't last.</response>
    [HttpGet("~/api/patients/{patientId:guid}/stock-plan")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> StockPlan(Guid patientId, [FromQuery] int days = 7)
    {
        var p = await P(patientId);
        var owner = await db.Users.FindAsync(p.UserId);
        var today = DoseSchedule.LocalToday(DoseSchedule.ResolveTimeZone(owner?.TimeZoneId));
        var meds = (await db.Medicines.Where(x => x.PatientId == p.Id).ToListAsync())
            .Where(m => (!m.EndedOn.HasValue || m.EndedOn > today)).ToList();
        days = Math.Clamp(days, 1, 365);
        var proj = await Projections(p, meds, days);
        var refills = await LastRefills(meds.Select(m => m.Id).ToList());
        var rows = meds.Select(m =>
        {
            var sp = proj[m.Id];
            return new
            {
                MedicineId = m.Id,
                m.Name,
                m.Strength,
                m.Form,
                Condition = m.Condition,
                PrescribedBy = string.IsNullOrWhiteSpace(m.PrescribedBy) ? p.Doctor : m.PrescribedBy,
                m.DoseAmount,
                Times = DoseSchedule.Times(m),
                Frequency = m.FrequencyPattern,
                sp.PerDose,
                sp.Unit,
                sp.DosesPerDay,
                sp.QuantityPerDay,
                m.StockQuantity,
                sp.DosesLeft,
                sp.DaysLeft,
                RunOutDate = sp.RunOutDate?.ToString("yyyy-MM-dd"),
                sp.QuantityNeeded,
                sp.QuantityToBuy,
                sp.Status,
                sp.Insufficient,
                Paused = DoseSchedule.IsPaused(m, today),
                CourseEnds = m.DurationType == "ongoing" ? null : m.StartDate.AddDays(DoseSchedule.DurationInDays(m) - 1).ToString("yyyy-MM-dd"),
                LastRefillAt = refills.TryGetValue(m.Id, out var at) ? at : m.LastRefillAt,
                m.RefillThreshold
            };
        }).OrderByDescending(r => r.Insufficient).ThenBy(r => r.DaysLeft ?? int.MaxValue).ToList();
        return Ok(new { patientId = p.Id, patientName = p.Name, doctor = p.Doctor, days, today = today.ToString("yyyy-MM-dd"), generatedAt = DateTimeOffset.UtcNow, rows });
    }

    /// <summary>
    /// Validates a request and copies it onto the entity.
    /// </summary>
    /// <param name="m">Entity to update.</param>
    /// <param name="r">Incoming request.</param>
    /// <exception cref="ArgumentException">Invalid input (mapped to 400 by the global handler).</exception>
    static void Apply(Medicine m, MedicineRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name) || string.IsNullOrWhiteSpace(r.Strength) || r.Times is null || r.Times.Count == 0)
            throw new ArgumentException("Medicine name, strength and at least one dose time are required.");
        m.Name = r.Name.Trim();
        m.Strength = r.Strength.Trim();
        m.Form = r.Form;
        m.Condition = r.Condition?.Trim() ?? "";
        m.FrequencyPattern = r.FrequencyPattern;
        m.SpecificDaysJson = JsonSerializer.Serialize(r.SpecificDays ?? []);
        m.CycleEvery = Math.Max(1, r.CycleEvery);
        m.CycleUnit = r.CycleUnit;
        m.TimesJson = JsonSerializer.Serialize(r.Times.Distinct());
        m.Liquid = r.Liquid;
        m.WithFood = r.WithFood;
        m.StartDate = DateOnly.TryParse(r.StartDate, out var startDate)
            ? startDate
            : throw new ArgumentException("Enter a valid start date (YYYY-MM-DD).");
        if (r.Times.Any(t => !TimeOnly.TryParseExact(t, "HH:mm", out _)))
            throw new ArgumentException("Dose times must use the HH:mm format, e.g. 08:00.");
        var amount = (r.DoseAmount ?? "").Trim();
        if (amount.Length == 0)
            throw new ArgumentException("Enter how much to take per dose (e.g. ½ tablet or 5 ml).");
        if (amount.Length > 60)
            throw new ArgumentException("Keep the dose amount short (60 characters max).");
        m.DoseAmount = amount;
        m.DurationType = r.DurationType;
        m.DurationValue = Math.Max(1, r.DurationValue);
        m.DurationUnit = r.DurationUnit;
        m.PrescribedBy = (r.PrescribedBy ?? m.PrescribedBy ?? "").Trim();
        m.IsRecurring = r.IsRecurring;
        m.RefillThreshold = r.IsRecurring ? Math.Max(0, r.RefillThreshold) : 0;
    }
}
