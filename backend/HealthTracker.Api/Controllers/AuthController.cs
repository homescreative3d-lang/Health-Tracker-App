using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Account registration, sign-in and the current-user lookup.
/// </summary>
[Route("api/auth")]
public class AuthController(IAuthService auth, AppDbContext db, INeonObjectStorage storage) : ApiControllerBase
{
    /// <summary>
    /// Creates an account and signs the user in.
    /// </summary>
    /// <remarks>An empty patient record is created for the user; the app's onboarding fills it in.</remarks>
    /// <param name="request">Email, password (min 8 characters) and display name (min 2 characters).</param>
    /// <response code="200">Account created; returns the user and a JWT valid for 8 hours.</response>
    /// <response code="409">The email is already registered, or the input is invalid.</response>
    [HttpPost("register")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        try
        {
            return Ok(await auth.Register(request));
        }
        catch (InvalidOperationException e)
        {
            return Conflict(new { message = e.Message });
        }
    }

    /// <summary>
    /// Signs in with email and password.
    /// </summary>
    /// <param name="request">Credentials.</param>
    /// <response code="200">Returns the user and a JWT valid for 8 hours.</response>
    /// <response code="401">Email or password is wrong.</response>
    [HttpPost("login")]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        try
        {
            return Ok(await auth.Login(request));
        }
        catch (UnauthorizedAccessException e)
        {
            return Unauthorized(new { message = e.Message });
        }
    }

    /// <summary>
    /// Returns the signed-in user.
    /// </summary>
    /// <response code="200">The current user, with a short-lived profile image URL.</response>
    /// <response code="401">The token is missing, expired, or the account no longer exists.</response>
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == CurrentUserId);
        if (user is null)
            return Unauthorized();
        return Ok(new UserResponse(user.Id, user.Email, user.DisplayName, user.TimeZoneId,
            string.IsNullOrWhiteSpace(user.ProfileImageUrl) ? null : storage.GetReadUrl("users", user.ProfileImageUrl)));
    }
}
