using System.Security.Claims;using HealthTracker.Api.Contracts;using HealthTracker.Api.Services;using Microsoft.AspNetCore.Authorization;using Microsoft.AspNetCore.Mvc;
namespace HealthTracker.Api.Controllers;
[Authorize][ApiController][Route("api/doses")]
public class DosesController(IDoseService s):ControllerBase
{
 Guid U=>Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
 [HttpGet]public async Task<IActionResult>Get([FromQuery]DateOnly? date,[FromQuery]Guid? patientId)=>Ok(await s.Get(U,date??DateOnly.FromDateTime(DateTime.UtcNow),patientId));
 [HttpPost("{id:guid}/taken")]public async Task<IActionResult>Take(Guid id){try{return Ok(await s.Take(U,id));}catch(InvalidOperationException e){return BadRequest(new{message=e.Message});}catch(UnauthorizedAccessException e){return Forbid();}}
 [HttpPost("{id:guid}/skip")]public async Task<IActionResult>Skip(Guid id,ReasonRequest r){try{return Ok(await s.Skip(U,id,r.Reason));}catch(InvalidOperationException e){return BadRequest(new{message=e.Message});}catch(UnauthorizedAccessException){return Forbid();}}
 [HttpPost("{id:guid}/reschedule")]public async Task<IActionResult>Reschedule(Guid id,RescheduleRequest r){try{return Ok(await s.Reschedule(U,id,DateOnly.Parse(r.Date)));}catch(UnauthorizedAccessException){return Forbid();}}
 [HttpPost("{id:guid}/undo")]public async Task<IActionResult>Undo(Guid id){try{return Ok(await s.Undo(U,id));}catch(UnauthorizedAccessException){return Forbid();}}
}