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
        if(p is null)return Ok(new{id=Guid.Empty,name="",dob=(DateOnly?)null,conditions=Array.Empty<string>(),notes="",relationship=(string?)null,mobile="",doctor="",medicalHistory="",profileImageUrl=(string?)null});
        return Ok(await Map(p));
    }

    [HttpGet("all")]public async Task<IActionResult>All()
    {
        var ids=await AccessibleUsers();
        var rows=await db.Patients.Where(x=>ids.Contains(x.UserId)).Join(db.Users,p=>p.UserId,u=>u.Id,(p,u)=>new{p,u}).ToListAsync();
        var result=await Task.WhenAll(rows.Select(async x=>new{x.p.Id,x.p.UserId,x.p.Name,x.p.Dob,Conditions=JsonSerializer.Deserialize<List<string>>(x.p.ConditionsJson)??[],x.p.Notes,x.p.Relationship,x.p.Mobile,x.p.Doctor,x.p.MedicalHistory,ProfileImageUrl=string.IsNullOrWhiteSpace(x.p.ProfileImageUrl)?null:storage.GetReadUrl("patient",x.p.ProfileImageUrl),OwnerName=x.u.DisplayName,OwnerEmail=x.u.Email}));
        return Ok(result);
    }

    [HttpPost]public async Task<IActionResult>Create(PatientRequest r)
    {
        var p=Build(r,U);
        if(IsDataImage(r.ProfileImageUrl))p.ProfileImageUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/{Guid.NewGuid():N}",r.ProfileImageUrl);
        db.Patients.Add(p);await db.SaveChangesAsync();return Ok(await Map(p));
    }

    [HttpPut]public Task<IActionResult>Put(PatientRequest r)=>UpdateOwned(null,r);
    [HttpPut("{id:guid}")]public Task<IActionResult>Put(Guid id,PatientRequest r)=>UpdateOwned(id,r);

    async Task<IActionResult>UpdateOwned(Guid? id,PatientRequest r)
    {
        var p=await db.Patients.SingleOrDefaultAsync(x=>x.Id==(id??Guid.Empty)&&x.UserId==U);
        if(id is null)p=await db.Patients.SingleOrDefaultAsync(x=>x.UserId==U);
        if(p is null)return NotFound();
        var old=p.ProfileImageUrl;
        p.Name=r.Name.Trim();p.Dob=string.IsNullOrWhiteSpace(r.Dob)?null:DateOnly.Parse(r.Dob);p.ConditionsJson=JsonSerializer.Serialize(r.Conditions??[]);
        p.Notes=r.Notes;p.Relationship=r.Relationship;p.Mobile=r.Mobile?.Trim()??"";p.Doctor=r.Doctor?.Trim()??"";p.MedicalHistory=r.MedicalHistory?.Trim()??"";
        if(IsDataImage(r.ProfileImageUrl))p.ProfileImageUrl=await storage.PutDataUrlAsync("patient",$"{p.Id}/{Guid.NewGuid():N}",r.ProfileImageUrl);
        else if(string.IsNullOrWhiteSpace(r.ProfileImageUrl))p.ProfileImageUrl=null; else if(!r.ProfileImageUrl.StartsWith("http",StringComparison.OrdinalIgnoreCase))p.ProfileImageUrl=r.ProfileImageUrl.Trim();
        if(p.ProfileImageUrl!=old&&!string.IsNullOrWhiteSpace(old))await storage.DeleteAsync("patient",old);
        await db.SaveChangesAsync();return Ok(await Map(p));
    }

    static bool IsDataImage(string? value)=>!string.IsNullOrWhiteSpace(value)&&value.StartsWith("data:image/",StringComparison.OrdinalIgnoreCase);
    static Patient Build(PatientRequest r,Guid uid)=>new(){UserId=uid,Name=r.Name.Trim(),Dob=string.IsNullOrWhiteSpace(r.Dob)?null:DateOnly.Parse(r.Dob),ConditionsJson=JsonSerializer.Serialize(r.Conditions??[]),Notes=r.Notes,Relationship=r.Relationship,Mobile=r.Mobile?.Trim()??"",Doctor=r.Doctor?.Trim()??"",MedicalHistory=r.MedicalHistory?.Trim()??"",ProfileImageUrl=null};
    async Task<object>Map(Patient p)=>new{p.Id,p.Name,p.Dob,Conditions=JsonSerializer.Deserialize<List<string>>(p.ConditionsJson)??[],p.Notes,p.Relationship,p.Mobile,p.Doctor,p.MedicalHistory,ProfileImageUrl=string.IsNullOrWhiteSpace(p.ProfileImageUrl)?null:storage.GetReadUrl("patient",p.ProfileImageUrl)};
    async Task<List<Guid>>AccessibleUsers(){var ids=await db.FamilyMembers.Where(x=>x.UserId==U&&x.Status=="approved").Join(db.FamilyMembers,a=>a.FamilyId,b=>b.FamilyId,(a,b)=>b.UserId).Distinct().ToListAsync();ids.Add(U);return ids;}
}