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
public class NotificationsController(AppDbContext db, IConfiguration config, IPushNotificationService push) : ApiControllerBase
{
    private Guid UserId => CurrentUserId;

    /// <summary>
    /// Returns reminder timing settings and the server's VAPID public key (needed to subscribe to push).
    /// </summary>
    /// <response code="200">Settings.</response>
    [HttpGet("settings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSettings()
    {
        var user = await db.Users.FindAsync(UserId);
        return Ok(new { timeZoneId = user?.TimeZoneId ?? "Asia/Kolkata", leadMinutes = user?.NotificationLeadMinutes ?? 15, repeatMinutes = user?.NotificationRepeatMinutes ?? 5, finalNotificationEnabled = user?.FinalNotificationEnabled ?? true, vapidPublicKey = config["WebPush:PublicKey"] });
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
        return Ok(new { timeZoneId = user.TimeZoneId, leadMinutes = user.NotificationLeadMinutes, repeatMinutes = user.NotificationRepeatMinutes, finalNotificationEnabled = user.FinalNotificationEnabled, vapidPublicKey = config["WebPush:PublicKey"] });
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
    /// Sends a test push to every device the user has subscribed.
    /// </summary>
    /// <response code="200">Delivered to at least one device.</response>
    /// <response code="400">No device accepted the push.</response>
    /// <response code="503">Web Push keys aren't configured on the server.</response>
    [HttpPost("push/test")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> SendTestPush()
    {
        if (string.IsNullOrWhiteSpace(config["WebPush:PublicKey"]) || string.IsNullOrWhiteSpace(config["WebPush:PrivateKey"]))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Browser push is not configured on the API. Configure WebPush:PublicKey and WebPush:PrivateKey." });
        }

        var sent = await push.SendToUsersAsync([UserId], "Tended test notification", "Browser notifications are connected to your medication reminders.", "test_notification", ct: HttpContext.RequestAborted);
        if (!sent)
        {
            return BadRequest(new { message = "The API could not deliver a push notification. Enable browser notifications on this device and verify the VAPID keys and subscription." });
        }

        return Ok(new { status = "sent", message = "Test notification sent to this browser." });
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
