using System.Security.Claims;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
[Authorize]
[ApiController]
[Route("api/medicine-actions")]
public class MedicineActionsController(HealthTracker.Api.Data.AppDbContext db) : ControllerBase
{
    Guid U => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, PauseMedicineRequest r)
    {
        var m = await db.Medicines.FindAsync(id);
        if (m is null)
            return NotFound();
        if (!await CanAccess(m.PatientId))
            return Forbid();
        if (!DateOnly.TryParse(r.StartDate, out var start))
            return BadRequest(new { message = "Invalid pause date." });
        m.PauseStartDate = start;
        m.PauseEndDate = string.IsNullOrWhiteSpace(r.EndDate) ? null : DateOnly.Parse(r.EndDate);
        await db.SaveChangesAsync();
        return Ok(new { m.Id, m.PauseStartDate, m.PauseEndDate });
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id)
    {
        var m = await db.Medicines.FindAsync(id);
        if (m is null)
            return NotFound();
        if (!await CanAccess(m.PatientId))
            return Forbid();
        m.PauseEndDate = DateOnly.FromDateTime(DateTime.UtcNow);
        await db.SaveChangesAsync();
        return Ok(new { m.Id, m.PauseStartDate, m.PauseEndDate });
    }

    async Task<bool> CanAccess(Guid patientId)
    {
        var p = await db.Patients.FindAsync(patientId);
        if (p is null)
            return false;
        if (p.UserId == U)
            return true;
        var ids = await db.FamilyMembers.Where(x => x.UserId == U && x.Status == "approved").Join(db.FamilyMembers, a => a.FamilyId, b => b.FamilyId, (a, b) => b.UserId).Distinct().ToListAsync();
        return ids.Contains(p.UserId);
    }
}
