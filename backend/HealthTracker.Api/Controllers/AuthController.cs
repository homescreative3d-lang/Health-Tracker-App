using System.Security.Claims;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

[ApiController][Route("api/auth")]
public class AuthController(IAuthService a,AppDbContext db,INeonObjectStorage storage):ControllerBase
{
    [HttpPost("register")]public async Task<ActionResult<AuthResponse>>Register(RegisterRequest r){try{return Ok(await a.Register(r));}catch(InvalidOperationException e){return Conflict(new{message=e.Message});}}
    [HttpPost("login")]public async Task<ActionResult<AuthResponse>>Login(LoginRequest r){try{return Ok(await a.Login(r));}catch(UnauthorizedAccessException e){return Unauthorized(new{message=e.Message});}}
    [Authorize][HttpGet("me")]public async Task<ActionResult<UserResponse>>Me()
    {
        var id=Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var u=await db.Users.SingleOrDefaultAsync(x=>x.Id==id);if(u is null)return Unauthorized();
        return Ok(new UserResponse(u.Id,u.Email,u.DisplayName,u.TimeZoneId,string.IsNullOrWhiteSpace(u.ProfileImageUrl)?null:storage.GetReadUrl("users",u.ProfileImageUrl)));
    }
}