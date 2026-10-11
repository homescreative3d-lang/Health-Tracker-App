using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// In-app notifications, reminder settings and Web Push device subscriptions.
/// </summary>
[Authorize]
[Route("api/notifications")]
public class NotificationsController(AppDbContext db, IPushNotificationService push, VapidKeyStore keys) : ApiControllerBase
{
    private Guid UserId => CurrentUserId;

    /// <summary>
    /// Returns reminder timing settings, the server's VAPID public key (needed to subscribe to push),
    /// whether push is configured on the server, and how many devices this user has subscribed.
    /// </summary>
    /// <response code="200">Settings.</response>
    [HttpGet("settings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings()
    {
        var user = await db.Users.FindAsync(UserId);
        var devices = await db.PushSubscriptions.CountAsync(s => s.UserId == UserId);
        return Ok(new { timeZoneId = user?.TimeZoneId ?? "Asia/Kolkata", leadMinutes = user?.NotificationLeadMinutes ?? 15, repeatMinutes = user?.NotificationRepeatMinutes ?? 5, finalNotificationEnabled = user?.FinalNotificationEnabled ?? true, vapidPublicKey = keys.IsReady ? keys.PublicKey : null, pushConfigured = keys.IsReady, keySource = keys.Source, subscribedDevices = devices });
    }

    /// <summary>
    /// Saves reminder timing settings.
    /// </summary>
    /// <param name="request">Time zone id; first reminder 0–120 minutes before; repeat every 1–60 minutes.</param>
    /// <response code="200">Saved settings.</response>
    /// <response code="400">Values out of range or unknown time zone.</response>
    [HttpPut("settings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SaveSettings(NotificationSettingsRequest request)
    {
        if (request.LeadMinutes > 0 && request.RepeatMinutes > request.LeadMinutes)
            return BadRequest(new { message = $"Repeat interval can't be longer than the first reminder ({request.LeadMinutes} min before), or no repeat would ever be sent." });
        if (request.LeadMinutes is < 0 or > 120 || request.RepeatMinutes is < 1 or > 60)
        {
            return BadRequest(new { message = "Notification timings are invalid." });
        }

        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return BadRequest(new { message = "Unknown timezone." });
        }
        catch (InvalidTimeZoneException)
        {
            return BadRequest(new { message = "The selected timezone is invalid." });
        }

        var user = await db.Users.FindAsync(UserId);
        if (user is null)
        {
            return NotFound();
        }

        user.TimeZoneId = request.TimeZoneId;
        user.NotificationLeadMinutes = request.LeadMinutes;
        user.NotificationRepeatMinutes = request.RepeatMinutes;
        user.FinalNotificationEnabled = request.FinalNotificationEnabled;
        await db.SaveChangesAsync();
        return Ok(new { timeZoneId = user.TimeZoneId, leadMinutes = user.NotificationLeadMinutes, repeatMinutes = user.NotificationRepeatMinutes, finalNotificationEnabled = user.FinalNotificationEnabled, vapidPublicKey = keys.IsReady ? keys.PublicKey : null, pushConfigured = keys.IsReady });
    }

    /// <summary>
    /// Registers (or refreshes) this device's Web Push subscription.
    /// </summary>
    /// <param name="request">Subscription from <c>PushManager.subscribe()</c>.</param>
    /// <response code="200">Subscribed.</response>
    /// <response code="400">Incomplete subscription.</response>
    [HttpPost("push/subscribe")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Subscribe(PushSubscriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint) || string.IsNullOrWhiteSpace(request.P256dh) || string.IsNullOrWhiteSpace(request.Auth))
        {
            return BadRequest(new { message = "Invalid push subscription." });
        }

        var subscription = await db.PushSubscriptions.SingleOrDefaultAsync(item => item.UserId == UserId && item.Endpoint == request.Endpoint);
        if (subscription is null)
        {
            db.PushSubscriptions.Add(new PushSubscription { UserId = UserId, Endpoint = request.Endpoint, P256dh = request.P256dh, Auth = request.Auth });
        }
        else
        {
            subscription.P256dh = request.P256dh;
            subscription.Auth = request.Auth;
            subscription.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        return Ok(new { status = "subscribed" });
    }

    /// <summary>
    /// Removes a device's Web Push subscription.
    /// </summary>
    /// <param name="request">Subscription to remove (matched by endpoint).</param>
    /// <response code="204">Removed (or wasn't registered).</response>
    [HttpDelete("push/subscribe")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Unsubscribe(PushSubscriptionRequest request)
    {
        var subscription = await db.PushSubscriptions.SingleOrDefaultAsync(item => item.UserId == UserId && item.Endpoint == request.Endpoint);
        if (subscription is not null)
        {
            db.PushSubscriptions.Remove(subscription);
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    /// <summary>
    /// Sends a test push to every device the user has subscribed and explains any failure.
    /// </summary>
    /// <remarks>
    /// <c>reason</c> values: <c>not_configured</c> (server keys missing), <c>no_subscription</c>
    /// (enable alerts on this device), <c>keys_mismatch</c> (device subscribed with old keys; it was
    /// removed, enable again), <c>expired</c>, <c>error</c>.
    /// </remarks>
    /// <response code="200">Delivered to at least one device.</response>
    /// <response code="400">Not delivered; see <c>reason</c> and <c>message</c>.</response>
    /// <response code="503">Web Push keys aren't configured on the server.</response>
    [HttpPost("push/test")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> SendTestPush()
    {
        var r = await push.SendTestAsync(UserId, HttpContext.RequestAborted);
        var message = r.Reason switch
        {
            null => $"Test notification sent to {r.Delivered} device{(r.Delivered == 1 ? "" : "s")}.",
            "not_configured" => "Push keys could not be loaded on the server. Notifications still appear in the bell; check the server logs.",
            "no_subscription" => "This account has no device signed up for alerts. Press “Enable alerts on this device” first.",
            "keys_mismatch" => "This device was signed up with older server keys, so the push service rejected it. The old sign-up was removed: press “Enable alerts on this device” again.",
            "expired" => "This device's sign-up had expired and was removed. Press “Enable alerts on this device” again.",
            _ => "The push service returned an error. Try enabling alerts again; if it keeps failing, check the server logs."
        };
        var body = new { status = r.Reason is null ? "sent" : "failed", reason = r.Reason, message, r.Subscriptions, r.Delivered, r.Removed, detail = r.Detail };
        if (r.Reason == "not_configured")
            return StatusCode(StatusCodes.Status503ServiceUnavailable, body);
        return r.Reason is null ? Ok(body) : BadRequest(body);
    }

    /// <summary>
    /// Lists notifications from the last three days (max 100, newest first).
    /// </summary>
    /// <response code="200">Notifications.</response>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var rows = await db.Notifications.Where(notification => notification.UserId == UserId && notification.CreatedAt >= DateTimeOffset.UtcNow.AddDays(-3)).OrderByDescending(notification => notification.CreatedAt).Take(100).ToListAsync();
        return Ok(rows);
    }

    /// <summary>
    /// Marks one notification read.
    /// </summary>
    /// <param name="id">Notification id.</param>
    /// <response code="200">Updated notification.</response>
    /// <response code="404">Not found.</response>
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var notification = await db.Notifications.SingleOrDefaultAsync(item => item.Id == id && item.UserId == UserId);
        if (notification is null)
        {
            return NotFound();
        }

        notification.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(notification);
    }

    /// <summary>
    /// Marks every unread notification for the user as read.
    /// </summary>
    /// <response code="200">Number of notifications updated.</response>
    [HttpPost("read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllRead()
    {
        var unread = await db.Notifications.Where(n => n.UserId == UserId && !n.IsRead).ToListAsync();
        foreach (var notification in unread)
            notification.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(new { updated = unread.Count });
    }
}
