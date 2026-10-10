using HealthTracker.Api.Contracts;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Daily doses: list a day's schedule and record take / skip / undo / reschedule.
/// </summary>
/// <remarks>
/// Take, skip and undo are accepted only from the scheduled time until one hour after it,
/// evaluated in the patient owner's time zone. Pending doses whose time has passed are
/// reported as <c>missed</c> but stay actionable until the window closes.
/// </remarks>
[Authorize]
[Route("api/doses")]
public class DosesController(IDoseService doses) : ApiControllerBase
{
    /// <summary>
    /// Lists the doses scheduled for a patient on a date, creating dose records on first view.
    /// </summary>
    /// <param name="date">Date (<c>YYYY-MM-DD</c>); defaults to today (UTC).</param>
    /// <param name="patientId">Patient; defaults to the user's own first patient.</param>
    /// <response code="200">Doses ordered by time.</response>
    /// <response code="403">No access to the patient.</response>
    /// <response code="404">Patient not found.</response>
    [HttpGet]
    [ProducesResponseType<List<DoseResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get([FromQuery] DateOnly? date, [FromQuery] Guid? patientId) =>
        Ok(await doses.Get(CurrentUserId, date ?? DateOnly.FromDateTime(DateTime.UtcNow), patientId));

    /// <summary>
    /// Marks a dose as taken and decrements the medicine's supply.
    /// </summary>
    /// <param name="id">Dose id.</param>
    /// <response code="200">The updated dose.</response>
    /// <response code="400">Outside the action window, or no supply left.</response>
    /// <response code="403">No access to the dose.</response>
    [HttpPost("{id:guid}/taken")]
    [ProducesResponseType<DoseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> Take(Guid id) => Run(() => doses.Take(CurrentUserId, id));

    /// <summary>
    /// Marks a dose as skipped (counts as missed in adherence).
    /// </summary>
    /// <param name="id">Dose id.</param>
    /// <param name="request">Reason shown in history.</param>
    /// <response code="200">The updated dose.</response>
    /// <response code="400">Outside the action window.</response>
    /// <response code="403">No access to the dose.</response>
    [HttpPost("{id:guid}/skip")]
    [ProducesResponseType<DoseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> Skip(Guid id, ReasonRequest request) => Run(() => doses.Skip(CurrentUserId, id, request.Reason));

    /// <summary>
    /// Moves one dose to another date and time.
    /// </summary>
    /// <remarks>
    /// The original dose becomes <c>rescheduled</c> ("moved to …") and a new pending dose is created at
    /// the target with <c>rescheduledFromId</c> set, so it shows a "Rescheduled" badge, gets reminders, and
    /// can be taken normally. Everyone caring for the patient receives a <c>dose_rescheduled</c> notification.
    /// Undo on the original removes the moved dose while it is still open.
    /// </remarks>
    /// <param name="id">Dose id.</param>
    /// <param name="request">Target date (<c>YYYY-MM-DD</c>) and optional time (<c>HH:mm</c>).</param>
    /// <response code="200">The newly created (moved) dose.</response>
    /// <response code="400">Invalid or past target, slot already used, or dose already recorded.</response>
    /// <response code="403">No access to the dose.</response>
    [HttpPost("{id:guid}/reschedule")]
    [ProducesResponseType<DoseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> Reschedule(Guid id, RescheduleRequest request) =>
        DateOnly.TryParse(request.Date, out var date)
            ? Run(() => doses.Reschedule(CurrentUserId, id, date, request.Time))
            : Task.FromResult<IActionResult>(BadRequestMessage("Enter a valid date (YYYY-MM-DD)."));

    /// <summary>
    /// Reverts a taken/skipped dose to pending (restores supply if it was taken).
    /// </summary>
    /// <param name="id">Dose id.</param>
    /// <response code="200">The updated dose.</response>
    /// <response code="400">Outside the action window.</response>
    /// <response code="403">No access to the dose.</response>
    [HttpPost("{id:guid}/undo")]
    [ProducesResponseType<DoseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public Task<IActionResult> Undo(Guid id) => Run(() => doses.Undo(CurrentUserId, id));

    /// <summary>
    /// Executes a dose action, translating business-rule violations to 400 and access failures to 403.
    /// </summary>
    /// <param name="action">The service call.</param>
    private async Task<IActionResult> Run(Func<Task<DoseResponse>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (InvalidOperationException e)
        {
            return BadRequestMessage(e.Message);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
