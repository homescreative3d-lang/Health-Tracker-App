using System.Security.Claims;using HealthTracker.Api.Data;using Microsoft.AspNetCore.Authorization;using Microsoft.AspNetCore.Mvc;using Microsoft.EntityFrameworkCore;
namespace HealthTracker.Api.Controllers;
[Authorize][ApiController][Route("api/history")]
public class HistoryController(AppDbContext db):ControllerBase
{
 Guid U=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpGet]public async Task<IActionResult>Get([FromQuery]string? patientIds,[FromQuery]Guid? medicineId,[FromQuery]string? from,[FromQuery]string? to,[FromQuery]string? period,[FromQuery]string? medicineName)
 {
  var ids=await AccessibleUsers();var pids=await db.Patients.Where(p=>ids.Contains(p.UserId)).Select(p=>p.Id).ToListAsync();if(!string.IsNullOrWhiteSpace(patientIds)){var wanted=patientIds.Split(',',StringSplitOptions.RemoveEmptyEntries).Select(x=>Guid.TryParse(x,out var id)?id:Guid.Empty).Where(x=>x!=Guid.Empty).ToHashSet();pids=pids.Where(wanted.Contains).ToList();}
  DateOnly? f=DateOnly.TryParse(from,out var fd)?fd:null,t=DateOnly.TryParse(to,out var td)?td:null;
  var q=from d in db.DoseEvents join p in db.Patients on d.PatientId equals p.Id join m in db.Medicines on d.MedicineId equals m.Id where pids.Contains(p.Id) select new{d,p,m};
  if(medicineId.HasValue)q=q.Where(x=>x.m.Id==medicineId.Value);if(!string.IsNullOrWhiteSpace(medicineName))q=q.Where(x=>x.m.Name.Contains(medicineName));if(f.HasValue)q=q.Where(x=>x.d.Date>=f);if(t.HasValue)q=q.Where(x=>x.d.Date<=t);
  var rows=await q.OrderByDescending(x=>x.d.Date).ThenByDescending(x=>x.d.Time).Take(1000).ToListAsync();
  var actorIds=rows.Where(x=>x.d.ActionedByUserId.HasValue).Select(x=>x.d.ActionedByUserId!.Value).Distinct().ToList();var actors=await db.Users.Where(x=>actorIds.Contains(x.Id)).ToDictionaryAsync(x=>x.Id,x=>x.DisplayName);
  if(!string.IsNullOrWhiteSpace(period))rows=rows.Where(x=>Bucket(x.d.Time)==period).ToList();
  return Ok(rows.Select(x=>new{Id=x.d.Id,PatientId=x.p.Id,PatientName=x.p.Name,MedicineId=x.m.Id,MedicineName=x.m.Name,Time=x.d.Time,Date=x.d.Date.ToString("yyyy-MM-dd"),Status=x.d.Status,TakenAt=x.d.TakenAt,SkipReason=x.d.SkipReason,ActionedByUserId=x.d.ActionedByUserId,ActionedByName=x.d.ActionedByUserId.HasValue&&actors.TryGetValue(x.d.ActionedByUserId.Value,out var name)?name:null}));
 }
 async Task<List<Guid>> AccessibleUsers(){var ids=await db.FamilyMembers.Where(x=>x.UserId==U&&x.Status=="approved").Join(db.FamilyMembers,a=>a.FamilyId,b=>b.FamilyId,(a,b)=>b.UserId).Distinct().ToListAsync();ids.Add(U);return ids;}
 static string Bucket(string time){if(!TimeSpan.TryParse(time,out var t))return"Night";var m=t.Hours*60+t.Minutes;return m<690?"Morning":m<1020?"Noon":m<1260?"Evening":"Night";}
}