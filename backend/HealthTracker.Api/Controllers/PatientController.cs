using System.Security.Claims;
using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

[Authorize][ApiController][Route("api/patient")]
public class PatientController(AppDbContext db,INeonObjectStorage storage):ControllerBase
{
    Guid U=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]public async Task<IActionResult>Get()
    {
        var p=await db.Patients.FirstOrDefaultAsync(x=>x.UserId==U);
        if(p is null)return Ok(new{id=Guid.Empty,name="",dob=(DateOnly?)null,conditions=Array.Empty<string>(),notes="",relationship=(string?)null,mobile="",doctor="",medicalHistory="",doctorPhotoUrl=(string?)null,profileImageUrl=(string?)null,attachments=Array.Empty<object>()});
        return Ok(await Map(p));
    }

    [HttpGet("all")]public async Task<IActionResult>All()
    {
        var ids=await AccessibleUsers();
        var rows=await db.Patients.Where(x=>ids.Contains(x.UserId)).Join(db.Users,p=>p.UserId,u=>u.Id,(p,u)=>new{p,u}).ToListAsync();
        var result=await Task.WhenAll(rows.Select(async x=>new{x.p.Id,x.p.UserId,x.p.Name,x.p.Dob,Conditions=JsonSerializer.Deserialize<List<string>>(x.p.ConditionsJson)??[],x.p.Notes,x.p.Relationship,x.p.Mobile,x.p.Doctor,x.p.MedicalHistory,DoctorPhotoUrl=string.IsNullOrWhiteSpace(x.p.DoctorPhotoUrl)?null:storage.GetReadUrl("patient",x.p.DoctorPhotoUrl),ProfileImageUrl=string.IsNullOrWhiteSpace(x.p.ProfileImageUrl)?null:storage.GetReadUrl("patient",x.p.ProfileImageUrl),Attachments=MapAttachments(x.p),OwnerName=x.u.DisplayName,OwnerEmail=x.u.Email}));
        return Ok(result);
    }

    [HttpPost]public async Task<IActionResult>Create(PatientRequest r)
    {
        var p=Build(r,U);
        if(IsDataImage(r.ProfileImageUrl))p.ProfileImageUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/{Guid.NewGuid():N}",r.ProfileImageUrl);
        if(IsDataImage(r.DoctorPhotoUrl))p.DoctorPhotoUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/doctor-{Guid.NewGuid():N}",r.DoctorPhotoUrl);
        await UpdateAttachments(p,r.Attachments);
        db.Patients.Add(p);await db.SaveChangesAsync();return Ok(await Map(p));
    }

    [HttpPut]public Task<IActionResult>Put(PatientRequest r)=>UpdateOwned(null,r);
    [HttpPut("{id:guid}")]public Task<IActionResult>Put(Guid id,PatientRequest r)=>UpdateOwned(id,r);

    async Task<IActionResult>UpdateOwned(Guid? id,PatientRequest r)
    {
        var accessible=await AccessibleUsers();
        var p=await db.Patients.SingleOrDefaultAsync(x=>x.Id==(id??Guid.Empty)&&accessible.Contains(x.UserId));
        if(id is null)p=await db.Patients.SingleOrDefaultAsync(x=>accessible.Contains(x.UserId));
        if(p is null)return NotFound();
        var old=p.ProfileImageUrl;
        p.Name=r.Name.Trim();p.Dob=string.IsNullOrWhiteSpace(r.Dob)?null:DateOnly.Parse(r.Dob);p.ConditionsJson=JsonSerializer.Serialize(r.Conditions??[]);
        p.Notes=r.Notes;p.Relationship=r.Relationship;p.Mobile=r.Mobile?.Trim()??"";p.Doctor=r.Doctor?.Trim()??"";p.MedicalHistory=r.MedicalHistory?.Trim()??"";
        var oldDoctorPhoto=p.DoctorPhotoUrl;
        if(IsDataImage(r.DoctorPhotoUrl))p.DoctorPhotoUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/doctor-{Guid.NewGuid():N}",r.DoctorPhotoUrl);
        else if(string.IsNullOrWhiteSpace(r.DoctorPhotoUrl))p.DoctorPhotoUrl=null; else if(!r.DoctorPhotoUrl.StartsWith("http",StringComparison.OrdinalIgnoreCase))p.DoctorPhotoUrl=r.DoctorPhotoUrl.Trim();
        if(p.DoctorPhotoUrl!=oldDoctorPhoto&&!string.IsNullOrWhiteSpace(oldDoctorPhoto))await storage.DeleteAsync("patient",oldDoctorPhoto);
        if(IsDataImage(r.ProfileImageUrl))p.ProfileImageUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/{Guid.NewGuid():N}",r.ProfileImageUrl);
        else if(string.IsNullOrWhiteSpace(r.ProfileImageUrl))p.ProfileImageUrl=null; else if(!r.ProfileImageUrl.StartsWith("http",StringComparison.OrdinalIgnoreCase))p.ProfileImageUrl=r.ProfileImageUrl.Trim();
        if(p.ProfileImageUrl!=old&&!string.IsNullOrWhiteSpace(old))await storage.DeleteAsync("patient",old);
        await UpdateAttachments(p,r.Attachments);
        await db.SaveChangesAsync();return Ok(await Map(p));
    }

    static bool IsDataImage(string? value)=>!string.IsNullOrWhiteSpace(value)&&value.StartsWith("data:image/",StringComparison.OrdinalIgnoreCase);
    static Patient Build(PatientRequest r,Guid uid)=>new(){UserId=uid,Name=r.Name.Trim(),Dob=string.IsNullOrWhiteSpace(r.Dob)?null:DateOnly.Parse(r.Dob),ConditionsJson=JsonSerializer.Serialize(r.Conditions??[]),Notes=r.Notes,Relationship=r.Relationship,Mobile=r.Mobile?.Trim()??"",Doctor=r.Doctor?.Trim()??"",MedicalHistory=r.MedicalHistory?.Trim()??"",ProfileImageUrl=null,DoctorPhotoUrl=null,AttachmentsJson="[]"};
    sealed record StoredAttachment(string Name,string MimeType,string Key,long Size);
    List<object> MapAttachments(Patient p)=> (JsonSerializer.Deserialize<List<StoredAttachment>>(p.AttachmentsJson??"[]")??[])
        .Select(a=>(object)new {a.Name,a.MimeType,a.Key,a.Size,Url=storage.GetReadUrl("patient",a.Key)}).ToList();
    async Task UpdateAttachments(Patient p,List<PatientAttachmentRequest>? requested)
    {
        if(requested is null)return;
        var old=JsonSerializer.Deserialize<List<StoredAttachment>>(p.AttachmentsJson??"[]")??[];
        var next=new List<StoredAttachment>();
        foreach(var item in requested)
        {
            if(!string.IsNullOrWhiteSpace(item.DataUrl))
            {
                var name=Path.GetFileName(item.Name);
                if(string.IsNullOrWhiteSpace(name))throw new ArgumentException("Attachment filename is required.");
                var key=$"{p.Id}/attachments/{Guid.NewGuid():N}";
                var stored=await storage.PutFileDataUrlAsync("patient",key,item.MimeType,item.DataUrl);
                next.Add(new StoredAttachment(name,stored.MimeType,stored.Key,stored.Size));
            }
            else if(!string.IsNullOrWhiteSpace(item.Key)&&item.Key.StartsWith($"{p.Id}/attachments/",StringComparison.Ordinal))
            {
                var existing=old.FirstOrDefault(a=>a.Key==item.Key);
                if(existing is not null)next.Add(existing);
            }
        }
        var keep=next.Select(a=>a.Key).ToHashSet(StringComparer.Ordinal);
        foreach(var removed in old.Where(a=>!keep.Contains(a.Key)))await storage.DeleteAsync("patient",removed.Key);
        p.AttachmentsJson=JsonSerializer.Serialize(next);
    }
    async Task<object>Map(Patient p)=>new{p.Id,p.Name,p.Dob,Conditions=JsonSerializer.Deserialize<List<string>>(p.ConditionsJson)??[],p.Notes,p.Relationship,p.Mobile,p.Doctor,p.MedicalHistory,DoctorPhotoUrl=string.IsNullOrWhiteSpace(p.DoctorPhotoUrl)?null:storage.GetReadUrl("patient",p.DoctorPhotoUrl),ProfileImageUrl=string.IsNullOrWhiteSpace(p.ProfileImageUrl)?null:storage.GetReadUrl("patient",p.ProfileImageUrl),Attachments=MapAttachments(p)};
    async Task<List<Guid>>AccessibleUsers(){var ids=await db.FamilyMembers.Where(x=>x.UserId==U&&x.Status=="approved").Join(db.FamilyMembers,a=>a.FamilyId,b=>b.FamilyId,(a,b)=>b.UserId).Distinct().ToListAsync();ids.Add(U);return ids;}
}