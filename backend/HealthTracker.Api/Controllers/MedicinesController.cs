using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
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
        return Ok((await db.Medicines.Where(x => x.PatientId == p.Id).ToListAsync()).Select(m => Map(m, p)));
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
        db.Medicines.Add(m);
        await audit.RecordAsync(CurrentUserId, "medicine", m.Id, "created", $"{m.Name} {m.Strength} added to the plan", p.Id, m.Id);
        await db.SaveChangesAsync();
        return Ok(Map(m, p));
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
        await audit.RecordAsync(CurrentUserId, "medicine", m.Id, "updated", $"{m.Name} details edited", p.Id, m.Id, null,
            new { before, after = new { m.Name, m.Strength, m.Form, m.TimesJson, m.FrequencyPattern, m.SupplyCount, m.DoseAmount } });
        await db.SaveChangesAsync();
        return Ok(Map(m, p));
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
        // Walk the reschedule chain backwards and forwards.
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
        var rows = await db.AuditLogs.Where(a => a.MedicineId != null && ids.Contains(a.MedicineId.Value)).OrderByDescending(a => a.At).Take(300).ToListAsync();
        return Ok(rows.Select(IAuditTrail.Map));
    }

    /// <summary>Loads the requested patient after checking access.</summary>
    /// <param name="patientId">Patient, or null for the user's own first patient.</param>
    Task<Patient> P(Guid? patientId) => access.GetAccessiblePatientAsync(CurrentUserId, patientId);

    /// <summary>Maps an entity to its API response.</summary>
    static MedicineResponse Map(Medicine m, Patient p) => new(m.Id, p.Id.ToString(), p.Name, m.Name, m.Strength, m.Form, m.Condition, m.FrequencyPattern, JsonSerializer.Deserialize<List<string>>(m.SpecificDaysJson) ?? [], m.CycleEvery, m.CycleUnit, JsonSerializer.Deserialize<List<string>>(m.TimesJson) ?? [], m.Liquid, m.WithFood, m.StartDate.ToString("yyyy-MM-dd"), m.DurationType, m.DurationValue, m.DurationUnit, m.SupplyCount, m.RefillThreshold, m.IsRecurring, m.PauseStartDate?.ToString("yyyy-MM-dd"), m.PauseEndDate?.ToString("yyyy-MM-dd"), m.EndedOn?.ToString("yyyy-MM-dd"), m.RescheduledFromId, string.IsNullOrWhiteSpace(m.PreviousTimesJson) ? null : JsonSerializer.Deserialize<List<string>>(m.PreviousTimesJson), m.DoseAmount);
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
        if (r.SupplyCount < 1)
            throw new ArgumentException("Supply count is required and must be at least 1.");
        m.SupplyCount = r.SupplyCount;
        m.IsRecurring = r.IsRecurring;
        m.RefillThreshold = r.IsRecurring ? Math.Max(0, r.RefillThreshold) : 0;
    }
}
