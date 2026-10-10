using System.Text.Json;using HealthTracker.Api.Data;using HealthTracker.Api.Models;using Microsoft.EntityFrameworkCore;
namespace HealthTracker.Api.Services;
public class NotificationScheduler(IServiceScopeFactory scopes,ILogger<NotificationScheduler> log):BackgroundService
{
 protected override async Task ExecuteAsync(CancellationToken stop){await Task.Delay(TimeSpan.FromSeconds(5),stop);while(!stop.IsCancellationRequested){try{using var scope=scopes.CreateScope();await Tick(scope.ServiceProvider,stop);}catch(Exception ex){log.LogError(ex,"Notification scheduler failed");}await Task.Delay(TimeSpan.FromSeconds(5),stop);}}
 static async Task Tick(IServiceProvider sp,CancellationToken ct)
 {
  var db=sp.GetRequiredService<AppDbContext>();var schedulerProvider=await db.Database.SqlQueryRaw<string>("SELECT \"Value\" AS \"Value\" FROM \"NotificationRuntimeConfig\" WHERE \"Key\" = 'NotificationSchedulerProvider'").FirstOrDefaultAsync(ct);if(!string.Equals(schedulerProvider,"dotnet",StringComparison.OrdinalIgnoreCase))return;var push=sp.GetRequiredService<IPushNotificationService>();var now=DateTimeOffset.UtcNow;var users=await db.Users.AsNoTracking().ToListAsync(ct);
  foreach(var user in users)
  {
   var zone=Zone(user.TimeZoneId);var local=TimeZoneInfo.ConvertTime(now,zone);var date=DateOnly.FromDateTime(local.DateTime);var ownerIds=await AccessibleOwnerIds(db,user.Id,ct);var patients=await db.Patients.Where(p=>ownerIds.Contains(p.UserId)).ToListAsync(ct);
   foreach(var p in patients)
   {
    var meds=await db.Medicines.Where(m=>m.PatientId==p.Id).ToListAsync(ct);
    foreach(var m in meds)
    {
     if(m.IsRecurring&&m.SupplyCount<=m.RefillThreshold)
     {
      var start=new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue),zone.GetUtcOffset(date.ToDateTime(TimeOnly.MinValue)));
      if(!await db.Notifications.AnyAsync(n=>n.UserId==user.Id&&n.Type=="refill_low"&&n.CreatedAt>=start&&n.DataJson.Contains(m.Id.ToString()),ct))
      {db.Notifications.Add(new AppNotification{UserId=user.Id,Type="refill_low",Title="Refill reminder",Message=$"{m.Name} has {m.SupplyCount} doses remaining.",DataJson=JsonSerializer.Serialize(new{medicineId=m.Id,patientId=p.Id})});await db.SaveChangesAsync(ct);await push.SendToUsersAsync([user.Id],"Refill reminder",$"{m.Name} for {p.Name} has {m.SupplyCount} doses remaining.","refill_low",null,ct,m.Form);}
     }
     if(!Occurs(m,date))continue;
     foreach(var time in JsonSerializer.Deserialize<List<string>>(m.TimesJson)??[])
     {
      if(!TimeOnly.TryParse(time,out var tod))continue;
      var scheduledLocal=date.ToDateTime(tod,DateTimeKind.Unspecified);var scheduled=new DateTimeOffset(scheduledLocal,zone.GetUtcOffset(scheduledLocal));
      var dose=await db.DoseEvents.SingleOrDefaultAsync(d=>d.PatientId==p.Id&&d.MedicineId==m.Id&&d.Date==date&&d.Time==time,ct);
      if(dose is null){dose=new DoseEvent{PatientId=p.Id,MedicineId=m.Id,Date=date,Time=time};db.DoseEvents.Add(dose);await db.SaveChangesAsync(ct);}
      if(dose.Status is "taken" or "skipped" or "rescheduled")continue;
      var until=(scheduled-now).TotalMinutes;
      if(until>0&&until<=Math.Max(0,user.NotificationLeadMinutes))
      {
       var occurrence=TruncateMinute(now);
       if(await Reserve(db,user.Id,dose.Id,"reminder",occurrence,ct))await Deliver(db,user.Id,p,m,dose,"Medicine reminder",$"{m.Name} ({m.Strength}) for {p.Name} is due at {tod}.","dose_reminder",occurrence,push,ct);
      }
      if(user.FinalNotificationEnabled&&Math.Abs(until)<=0.6)
      {
       if(await Reserve(db,user.Id,dose.Id,"final",scheduled,ct))await Deliver(db,user.Id,p,m,dose,"Medicine due now",$"{m.Name} ({m.Strength}) for {p.Name} is due now.","dose_final",scheduled,push,ct);
      }
      if(until<=0&&dose.Status=="pending"){dose.Status="missed";dose.MissedAt=now;await db.SaveChangesAsync(ct);}
      if(until<=0&&dose.Status=="missed")
      {
       if(await Reserve(db,user.Id,dose.Id,"missed",scheduled,ct))await Deliver(db,user.Id,p,m,dose,"Dose missed",$"{m.Name} ({m.Strength}) for {p.Name} was not marked taken at {tod}.","dose_missed",scheduled,push,ct);
      }
     }
    }
   }
  }
 }
 static async Task Deliver(AppDbContext db,Guid userId,Patient p,Medicine m,DoseEvent dose,string title,string body,string type,DateTimeOffset occurrence,IPushNotificationService push,CancellationToken ct)
 {
  var sent=await push.SendToUsersAsync([userId],title,body,type,dose.Id,ct,m.Form);
  var delivery=await db.NotificationDeliveries.SingleAsync(x=>x.UserId==userId&&x.DoseEventId==dose.Id&&x.Type==type&&x.ScheduledFor==occurrence,ct);
  delivery.SentAt=sent?DateTimeOffset.UtcNow:null;delivery.Status=sent?"sent":"failed";delivery.Error=sent?null:"No active browser push subscription or delivery failed.";
  if(!sent)db.Notifications.Add(new AppNotification{UserId=userId,Type="notification_failed",Title="Notification not delivered",Message=title+": "+m.Name+" for "+p.Name+".",DataJson=JsonSerializer.Serialize(new{doseId=dose.Id,type})});
  await db.SaveChangesAsync(ct);
 }
 static async Task<bool>Reserve(AppDbContext db,Guid user,Guid dose,string type,DateTimeOffset occurrence,CancellationToken ct){if(await db.NotificationDeliveries.AnyAsync(x=>x.UserId==user&&x.DoseEventId==dose&&x.Type==type&&x.ScheduledFor==occurrence,ct))return false;db.NotificationDeliveries.Add(new NotificationDelivery{UserId=user,DoseEventId=dose,Type=type,ScheduledFor=occurrence});await db.SaveChangesAsync(ct);return true;}
 static DateTimeOffset TruncateMinute(DateTimeOffset x)=>new(x.Year,x.Month,x.Day,x.Hour,x.Minute,0,TimeSpan.Zero);
 static async Task<List<Guid>>AccessibleOwnerIds(AppDbContext db,Guid user,CancellationToken ct){var ids=await db.FamilyMembers.Where(x=>x.UserId==user&&x.Status=="approved").Join(db.FamilyMembers,a=>a.FamilyId,b=>b.FamilyId,(a,b)=>b.UserId).Distinct().ToListAsync(ct);ids.Add(user);return ids.Distinct().ToList();}
 static TimeZoneInfo Zone(string id){try{return TimeZoneInfo.FindSystemTimeZoneById(id);}catch{return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");}}
 static bool Occurs(Medicine m,DateOnly d){if(d<m.StartDate||(m.PauseStartDate.HasValue&&d>=m.PauseStartDate.Value&&(!m.PauseEndDate.HasValue||d<=m.PauseEndDate.Value)))return false;var diff=d.DayNumber-m.StartDate.DayNumber;if(!m.IsRecurring&&diff!=0)return false;if(m.DurationType!="ongoing"){var days=m.DurationUnit=="weeks"?m.DurationValue*7:m.DurationUnit=="months"?m.DurationValue*30:m.DurationValue;if(diff>=days)return false;}return m.FrequencyPattern switch{"daily"=>true,"everyOtherDay"=>diff%2==0,"specificDays"=>(JsonSerializer.Deserialize<List<string>>(m.SpecificDaysJson)??[]).Contains(d.DayOfWeek.ToString()[..3],StringComparer.OrdinalIgnoreCase),"recurringCycle"=>m.CycleUnit=="weeks"?diff%(Math.Max(1,m.CycleEvery)*7)==0:m.CycleUnit=="months"?d.Day==m.StartDate.Day:diff%Math.Max(1,m.CycleEvery)==0,_=>false};}
}