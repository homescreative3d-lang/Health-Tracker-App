using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// File proxy: serves photos and documents through our API so storage paths and provider URLs
/// are never exposed. Links are opaque, encrypted and expire after one hour (see <see cref="FileLinks"/>).
/// </summary>
[Route("api/files")]
public class FilesController(FileLinks links, INeonObjectStorage storage) : ApiControllerBase
{
    /// <summary>
    /// Streams a stored file for an opaque token. Images and PDFs open inline; add
    /// <c>?download=1</c> to download with a friendly file name.
    /// </summary>
    /// <remarks>Anonymous by design so <c>&lt;img&gt;</c> tags work; the token itself is the credential and expires.</remarks>
    /// <param name="token">Opaque token from a file link.</param>
    /// <param name="download">True to force a download.</param>
    /// <response code="200">The file.</response>
    /// <response code="404">Unknown, tampered or expired link, or the file no longer exists.</response>
    [AllowAnonymous]
    [HttpGet("{token}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(string token, [FromQuery] bool download = false)
    {
        var ticket = links.Read(token);
        if (ticket is null)
            return NotFound(new { message = "This link has expired. Refresh the page to get a new one." });
        var file = await storage.OpenReadAsync(ticket.B, ticket.K, HttpContext.RequestAborted);
        if (file is null)
            return NotFound(new { message = "File not found." });
        Response.Headers[HeaderNames.CacheControl] = "private, max-age=600";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        var name = string.IsNullOrWhiteSpace(ticket.N) ? Path.GetFileName(ticket.K) : ticket.N;
        var inline = !download && (file.Value.ContentType.StartsWith("image/") || file.Value.ContentType == "application/pdf");
        var disposition = new ContentDispositionHeaderValue(inline ? "inline" : "attachment");
        disposition.SetHttpFileName(name);
        Response.Headers[HeaderNames.ContentDisposition] = disposition.ToString();
        return File(file.Value.Content, file.Value.ContentType);
    }
}
