using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Pausing and resuming a medicine's schedule.
/// </summary>
[Authorize]
[Route("api/medicine-actions")]
public class MedicineActionsController(AppDbContext db, IPatientAccessService access) : ApiControllerBase
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
}
