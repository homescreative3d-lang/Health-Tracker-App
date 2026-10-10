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
public class MedicinesController(AppDbContext db, IPatientAccessService access) : ApiControllerBase
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
        Apply(m, r);
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
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Loads the requested patient after checking access.</summary>
    /// <param name="patientId">Patient, or null for the user's own first patient.</param>
    Task<Patient> P(Guid? patientId) => access.GetAccessiblePatientAsync(CurrentUserId, patientId);

    /// <summary>Maps an entity to its API response.</summary>
    static MedicineResponse Map(Medicine m, Patient p) => new(m.Id, p.Id.ToString(), p.Name, m.Name, m.Strength, m.Form, m.Condition, m.FrequencyPattern, JsonSerializer.Deserialize<List<string>>(m.SpecificDaysJson) ?? [], m.CycleEvery, m.CycleUnit, JsonSerializer.Deserialize<List<string>>(m.TimesJson) ?? [], m.Liquid, m.WithFood, m.StartDate.ToString("yyyy-MM-dd"), m.DurationType, m.DurationValue, m.DurationUnit, m.SupplyCount, m.RefillThreshold, m.IsRecurring, m.PauseStartDate?.ToString("yyyy-MM-dd"), m.PauseEndDate?.ToString("yyyy-MM-dd"));
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
