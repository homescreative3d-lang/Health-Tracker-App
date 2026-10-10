using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// Base class for API controllers: JSON in/out and access to the signed-in user's id.
/// </summary>
[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>
    /// Id of the authenticated user, read from the JWT <c>NameIdentifier</c> claim.
    /// </summary>
    /// <exception cref="UnauthorizedAccessException">The request has no valid user claim.</exception>
    protected Guid CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new UnauthorizedAccessException("You are not signed in.");

    /// <summary>
    /// Returns a 400 response with a user-facing message.
    /// </summary>
    /// <param name="message">Message shown to the user.</param>
    protected BadRequestObjectResult BadRequestMessage(string message) => BadRequest(new { message });
}
