using HealthTracker.Api.Contracts;
using System.Text.Json;
using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Pausing, resuming and rescheduling a medicine's schedule.
/// </summary>
[Authorize]
[Route("api/medicine-actions")]
public class MedicineActionsController(AppDbContext db, IPatientAccessService access, ICareTeamNotifier notifier) : ApiControllerBase
{
    /// <summary>
    /// Pauses a medicine from a start date, optionally until an end date (inclusive).
    /// </summary>
    /// <param name="id">Medicine id.</param>
    /// <param name="request">Dates in <c>YYYY-MM-DD</c>; omit <c>endDate</c> to pause until resumed.</param>
    /// <response code="200">The new pause range.</response>
    /// <response code="400">A date is invalid or the end is before the start (previously a malformed end date returned 500).</response>
    /// <response code="403">No access to the medicine's patient.</response>
    /// <response code="404">Medicine not found.</response>
    [HttpPost("{id:guid}/pause")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Pause(Guid id, PauseMedicineRequest request)
    {
        var medicine = await db.Medicines.FindAsync(id);
        if (medicine is null)
            return NotFound();
        if (!await access.CanAccessPatientAsync(CurrentUserId, medicine.PatientId))
            return Forbid();
        if (!DateOnly.TryParse(request.StartDate, out var start))
            return BadRequestMessage("Invalid pause date.");
        DateOnly? end = null;
        if (!string.IsNullOrWhiteSpace(request.EndDate))
        {
            if (!DateOnly.TryParse(request.EndDate, out var parsedEnd) || parsedEnd < start)
                return BadRequestMessage("The pause end date must be a valid date on or after the start date.");
            end = parsedEnd;
        }

        medicine.PauseStartDate = start;
        medicine.PauseEndDate = end;
        await db.SaveChangesAsync();
        return Ok(new { medicine.Id, medicine.PauseStartDate, medicine.PauseEndDate });
    }

    /// <summary>
    /// Ends a pause as of today (UTC); doses resume tomorrow.
    /// </summary>
    /// <param name="id">Medicine id.</param>
    /// <response code="200">The updated pause range.</response>
    /// <response code="403">No access to the medicine's patient.</response>
    /// <response code="404">Medicine not found.</response>
    [HttpPost("{id:guid}/resume")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Resume(Guid id)
    {
        var medicine = await db.Medicines.FindAsync(id);
        if (medicine is null)
            return NotFound();
        if (!await access.CanAccessPatientAsync(CurrentUserId, medicine.PatientId))
            return Forbid();
        medicine.PauseEndDate = DateOnly.FromDateTime(DateTime.UtcNow);
        await db.SaveChangesAsync();
        return Ok(new { medicine.Id, medicine.PauseStartDate, medicine.PauseEndDate });
    }

    /// <summary>
    /// Changes a medicine's dose times from a date onwards, keeping earlier history intact.
    /// </summary>
    /// <remarks>
    /// The current record stops on <c>effectiveDate</c> (<c>endedOn</c>) and a new record continues
    /// with the new times, carrying the remaining supply and settings. The new record has
    /// <c>rescheduledFromId</c> and <c>previousTimes</c> so the app can mark it "Rescheduled".
    /// Doses already recorded on or after the date stay in history. The care team is notified.
    /// </remarks>
    /// <param name="id">Medicine id.</param>
    /// <param name="request">Effective date (today or later) and the new list of <c>HH:mm</c> times.</param>
    /// <response code="200">The new medicine record.</response>
    /// <response code="400">Invalid date/times, or the medicine is already rescheduled.</response>
    /// <response code="403">No access to the medicine's patient.</response>
    /// <response code="404">Medicine not found.</response>
    [HttpPost("{id:guid}/reschedule")]
    [ProducesResponseType<MedicineResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reschedule(Guid id, RescheduleMedicineRequest request)
    {
        var old = await db.Medicines.FindAsync(id);
        if (old is null)
            return NotFound();
        var patient = await db.Patients.FindAsync(old.PatientId);
        if (patient is null || !await access.CanAccessPatientAsync(CurrentUserId, old.PatientId))
            return Forbid();
        if (old.EndedOn.HasValue)
            return BadRequestMessage("This medicine was already rescheduled. Edit the current version instead.");
        if (!DateOnly.TryParse(request.EffectiveDate, out var effective))
            return BadRequestMessage("Choose a valid start date for the new schedule.");
        var owner = await db.Users.FindAsync(patient.UserId);
        var today = DoseSchedule.LocalToday(DoseSchedule.ResolveTimeZone(owner?.TimeZoneId));
        if (effective < today)
            return BadRequestMessage("The new schedule can't start in the past.");
        var times = (request.Times ?? []).Select(t => t.Trim()).Where(t => t.Length > 0).Distinct().OrderBy(t => t).ToList();
        if (times.Count == 0 || times.Any(t => !TimeOnly.TryParseExact(t, "HH:mm", out _)))
            return BadRequestMessage("Add at least one valid dose time (HH:mm).");
        var oldTimes = DoseSchedule.Times(old).ToList();
        if (times.SequenceEqual(oldTimes))
            return BadRequestMessage("Choose times that differ from the current schedule.");

        // Start the new record on the first day (on/after the effective date) the old schedule would
        // have run, so every-other-day and cycle patterns stay aligned and nothing applies retroactively.
        var start = effective < old.StartDate ? old.StartDate : effective;
        var guard = 0;
        while (!DoseSchedule.Occurs(old, start) && guard++ < 400)
            start = start.AddDays(1);
        if (guard >= 400)
            return BadRequestMessage("This medicine has no upcoming doses to reschedule.");
        // Finite courses keep only their remaining days.
        var durationDays = DoseSchedule.DurationInDays(old);
        var remainingDays = old.DurationType == "ongoing" ? 0 : old.StartDate.DayNumber + durationDays - start.DayNumber;

        var replacement = new Medicine
        {
            PatientId = old.PatientId,
            Name = old.Name,
            Strength = old.Strength,
            Form = old.Form,
            Condition = old.Condition,
            FrequencyPattern = old.FrequencyPattern,
            SpecificDaysJson = old.SpecificDaysJson,
            CycleEvery = old.CycleEvery,
            CycleUnit = old.CycleUnit,
            TimesJson = JsonSerializer.Serialize(times),
            Liquid = old.Liquid,
            WithFood = old.WithFood,
            StartDate = start,
            DurationType = old.DurationType,
            DurationValue = old.DurationType == "ongoing" ? old.DurationValue : Math.Max(1, remainingDays),
            DurationUnit = old.DurationType == "ongoing" ? old.DurationUnit : "days",
            SupplyCount = old.SupplyCount,
            RefillThreshold = old.RefillThreshold,
            IsRecurring = old.IsRecurring,
            PauseStartDate = old.PauseStartDate,
            PauseEndDate = old.PauseEndDate,
            RescheduledFromId = old.Id,
            PreviousTimesJson = JsonSerializer.Serialize(oldTimes)
        };
        old.EndedOn = effective;
        db.Medicines.Add(replacement);
        await db.SaveChangesAsync();

        await notifier.NotifyAsync(patient, "schedule_changed", "Medicine schedule changed",
            $"{old.Name} for {patient.Name} now runs at {string.Join(", ", times.Select(t => TimeOnly.ParseExact(t, "HH:mm").ToString("h:mm tt")))} from {effective:ddd d MMM}.",
            new { medicineId = replacement.Id, previousMedicineId = old.Id, patientId = patient.Id, patientName = patient.Name, medicineName = old.Name, effectiveDate = effective.ToString("yyyy-MM-dd"), times });

        return Ok(new MedicineResponse(replacement.Id, patient.Id.ToString(), patient.Name, replacement.Name, replacement.Strength, replacement.Form,
            replacement.Condition, replacement.FrequencyPattern, JsonSerializer.Deserialize<List<string>>(replacement.SpecificDaysJson) ?? [],
            replacement.CycleEvery, replacement.CycleUnit, times, replacement.Liquid, replacement.WithFood, replacement.StartDate.ToString("yyyy-MM-dd"),
            replacement.DurationType, replacement.DurationValue, replacement.DurationUnit, replacement.SupplyCount, replacement.RefillThreshold,
            replacement.IsRecurring, replacement.PauseStartDate?.ToString("yyyy-MM-dd"), replacement.PauseEndDate?.ToString("yyyy-MM-dd"),
            null, old.Id, oldTimes));
    }
}
