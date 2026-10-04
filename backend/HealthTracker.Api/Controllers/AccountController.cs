using System.Security.Claims;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;

[Authorize][ApiController][Route("api/account")]
public class AccountController(AppDbContext db,INeonObjectStorage storage):ControllerBase
{
    Guid U=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPut("profile")]
    public async Task<IActionResult>Update(ProfileUpdateRequest r)
    {
        if(string.IsNullOrWhiteSpace(r.DisplayName)||r.DisplayName.Trim().Length>80)return BadRequest(new{message="Display name is required and must be 80 characters or fewer."});
        var u=await db.Users.FindAsync(U);if(u is null)return NotFound();
        var old=u.ProfileImageUrl;
        if(!string.IsNullOrWhiteSpace(r.ProfileImageUrl)&&r.ProfileImageUrl.StartsWith("data:image/",StringComparison.OrdinalIgnoreCase))
            u.ProfileImageUrl=await storage.PutDataUrlAsync("users",$"{U}/{Guid.NewGuid():N}",r.ProfileImageUrl);
        else if(string.IsNullOrWhiteSpace(r.ProfileImageUrl))u.ProfileImageUrl=null; else if(!r.ProfileImageUrl.StartsWith("http",StringComparison.OrdinalIgnoreCase))u.ProfileImageUrl=r.ProfileImageUrl.Trim();
        if(u.ProfileImageUrl!=old&&!string.IsNullOrWhiteSpace(old))await storage.DeleteAsync("users",old);
        await db.SaveChangesAsync();
        return Ok(new{u.Id,u.Email,u.DisplayName,u.TimeZoneId,ProfileImageUrl=string.IsNullOrWhiteSpace(u.ProfileImageUrl)?null:storage.GetReadUrl("users",u.ProfileImageUrl)});
    }
}