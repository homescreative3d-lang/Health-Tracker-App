using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HealthTracker.Api.Infrastructure;

/// <summary>
/// Converts unhandled exceptions into RFC 7807 problem responses with a <c>message</c> field
/// that the web/Android client shows to users.
/// </summary>
/// <remarks>
/// Before this handler, domain errors thrown by services (invalid dates, missing patients,
/// access denied) escaped as HTTP 500 with no explanation. Mapping:
/// <list type="bullet">
/// <item><see cref="ArgumentException"/>, <see cref="FormatException"/> → 400</item>
/// <item><see cref="UnauthorizedAccessException"/> → 403</item>
/// <item><see cref="KeyNotFoundException"/> → 404</item>
/// <item>anything else → 500 with a generic message (details are logged, never returned).
/// <see cref="InvalidOperationException"/> is intentionally treated as a server error here:
/// business-rule violations are caught by controllers, so uncaught ones come from EF/framework
/// code and their messages must not reach clients.</item>
/// </list>
/// </remarks>
/// <param name="log">Logger for unexpected errors.</param>
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) : IExceptionHandler
{
    /// <summary>
    /// Writes a problem response for the exception.
    /// </summary>
    /// <param name="context">Current HTTP context.</param>
    /// <param name="exception">The unhandled exception.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><c>true</c>: the exception is always handled.</returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, message) = exception switch
        {
            ArgumentException or FormatException => (StatusCodes.Status400BadRequest, exception.Message),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, exception.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            OperationCanceledException when context.RequestAborted.IsCancellationRequested => (499, "Request cancelled."),
            _ => (StatusCodes.Status500InternalServerError, "Something went wrong on our side. Please try again.")
        };
        if (status >= 500)
            log.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
        else
            log.LogInformation("Request failed with {Status}: {Message}", status, exception.Message);

        var problem = new ProblemDetails
        {
            Status = status,
            Title = status >= 500 ? "Server error" : message,
            Instance = context.Request.Path
        };
        problem.Extensions["message"] = message;
        problem.Extensions["traceId"] = context.TraceIdentifier;
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
