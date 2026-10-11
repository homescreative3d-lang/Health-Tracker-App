using HealthTracker.Api.Domain;
using HealthTracker.Api.Services;
using HealthTracker.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// Dose history across every patient the user can access.
/// </summary>
[Authorize]
[Route("api/history")]
public class HistoryController(AppDbContext db, IPatientAccessService access) : ApiControllerBase
{

    /// <summary>
    /// Returns up to 1,000 dose records, newest first, with who recorded each action.
    /// </summary>
    /// <param name="patientIds">Comma-separated patient ids; defaults to all accessible patients.</param>
    /// <param name="medicineId">Only this medicine.</param>
    /// <param name="from">Earliest date (<c>YYYY-MM-DD</c>, inclusive).</param>
    /// <param name="to">Latest date (<c>YYYY-MM-DD</c>, inclusive).</param>
    /// <param name="period">Time of day: <c>Morning</c>, <c>Noon</c>, <c>Evening</c> or <c>Night</c>.</param>
    /// <param name="medicineName">Case-insensitive partial medicine name.</param>
    /// <response code="200">History rows.</response>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get([FromQuery] string? patientIds, [FromQuery] Guid? medicineId, [FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? period, [FromQuery] string? medicineName)
    {
        var accessiblePatients = await access.GetAccessiblePatientIdsAsync(CurrentUserId);
        var pids = accessiblePatients;
        if (!string.IsNullOrWhiteSpace(patientIds))
        {
            var wanted = patientIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => Guid.TryParse(x, out var id) ? id : Guid.Empty).Where(x => x != Guid.Empty).ToHashSet();
            pids = pids.Where(wanted.Contains).ToList();
        }

        DateOnly? f = DateOnly.TryParse(from, out var fd) ? fd : null, t = DateOnly.TryParse(to, out var td) ? td : null;
        var q =
            from d in db.DoseEvents
            join p in db.Patients on d.PatientId equals p.Id
            join m in db.Medicines on d.MedicineId equals m.Id
            where pids.Contains(p.Id)
            select new
            {
                d,
                p,
                m
            };
        if (medicineId.HasValue)
            q = q.Where(x => x.m.Id == medicineId.Value);
        if (!string.IsNullOrWhiteSpace(medicineName))
            q = q.Where(x => EF.Functions.ILike(x.m.Name, "%" + medicineName.Trim() + "%"));
        if (f.HasValue)
            q = q.Where(x => x.d.Date >= f);
        if (t.HasValue)
            q = q.Where(x => x.d.Date <= t);
        var rows = await q.OrderByDescending(x => x.d.Date).ThenByDescending(x => x.d.Time).Take(1000).ToListAsync();
        var actorIds = rows.Where(x => x.d.ActionedByUserId.HasValue).Select(x => x.d.ActionedByUserId!.Value).Distinct().ToList();
        var actors = await db.Users.Where(x => actorIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.DisplayName);
        if (!string.IsNullOrWhiteSpace(period))
            rows = rows.Where(x => Bucket(x.d.Time) == period).ToList();
        return Ok(rows.Select(x => new { Id = x.d.Id, PatientId = x.p.Id, PatientName = x.p.Name, MedicineId = x.m.Id, MedicineName = x.m.Name, Form = x.m.Form, Time = x.d.Time, Date = x.d.Date.ToString("yyyy-MM-dd"), Status = x.d.Status, TakenAt = x.d.TakenAt, SkipReason = x.d.SkipReason, ActionedByUserId = x.d.ActionedByUserId, ActionedByName = x.d.ActionedByUserId.HasValue && actors.TryGetValue(x.d.ActionedByUserId.Value, out var name) ? name : null }));
    }

    /// <summary>Maps a dose time to its history filter bucket.</summary>
    static string Bucket(string time) => DoseSchedule.DayPart(time);

    /// <summary>
    /// Audit trail of changes (dose actions, reschedules with reasons, pauses, medicine edits) for
    /// every accessible patient, newest first (max 500).
    /// </summary>
    /// <param name="patientIds">Comma-separated patient ids; defaults to all accessible patients.</param>
    /// <param name="from">Earliest date (inclusive, UTC).</param>
    /// <param name="to">Latest date (inclusive, UTC).</param>
    /// <response code="200">Audit entries.</response>
    [HttpGet("changes")]
    [RequiresFeature("change_history")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Changes(string? patientIds, DateOnly? from, DateOnly? to)
    {
        var visible = await access.GetAccessiblePatientIdsAsync(CurrentUserId);
        var accessible = await db.Patients.Where(p => visible.Contains(p.Id)).Select(p => new { p.Id, p.Name }).ToListAsync();
        var ids = accessible.Select(p => p.Id).ToList();
        if (!string.IsNullOrWhiteSpace(patientIds))
        {
            var wanted = patientIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(v => Guid.TryParse(v, out var g) ? g : Guid.Empty).ToHashSet();
            ids = ids.Where(wanted.Contains).ToList();
        }

        var q = db.AuditLogs.Where(a => a.PatientId != null && ids.Contains(a.PatientId.Value));
        if (from.HasValue)
        {
            var f = new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            q = q.Where(a => a.At >= f);
        }

        if (to.HasValue)
        {
            var t = new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            q = q.Where(a => a.At < t);
        }

        var rows = await q.OrderByDescending(a => a.At).Take(500).ToListAsync();
        var names = accessible.ToDictionary(p => p.Id, p => p.Name);
        return Ok(rows.Select(a => new { entry = IAuditTrail.Map(a), patientName = a.PatientId.HasValue && names.TryGetValue(a.PatientId.Value, out var n) ? n : "" }));
    }
}
