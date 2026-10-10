using System.Security.Claims;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController(
    AppDbContext db,
    IConfiguration config,
    IPushNotificationService push) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        var user = await db.Users.FindAsync(UserId);

        return Ok(new
        {
            timeZoneId = user?.TimeZoneId ?? "Asia/Kolkata",
            leadMinutes = user?.NotificationLeadMinutes ?? 15,
            repeatMinutes = user?.NotificationRepeatMinutes ?? 5,
            finalNotificationEnabled = user?.FinalNotificationEnabled ?? true,
            vapidPublicKey = config["WebPush:PublicKey"]
        });
    }

    [HttpPut("settings")]
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

        return Ok(new
        {
            timeZoneId = user.TimeZoneId,
            leadMinutes = user.NotificationLeadMinutes,
            repeatMinutes = user.NotificationRepeatMinutes,
            finalNotificationEnabled = user.FinalNotificationEnabled,
            vapidPublicKey = config["WebPush:PublicKey"]
        });
    }

    [HttpPost("push/subscribe")]
    public async Task<IActionResult> Subscribe(PushSubscriptionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Endpoint)
            || string.IsNullOrWhiteSpace(request.P256dh)
            || string.IsNullOrWhiteSpace(request.Auth))
        {
            return BadRequest(new { message = "Invalid push subscription." });
        }

        var subscription = await db.PushSubscriptions.SingleOrDefaultAsync(
            item => item.UserId == UserId && item.Endpoint == request.Endpoint);

        if (subscription is null)
        {
            db.PushSubscriptions.Add(new PushSubscription
            {
                UserId = UserId,
                Endpoint = request.Endpoint,
                P256dh = request.P256dh,
                Auth = request.Auth
            });
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

    [HttpDelete("push/subscribe")]
    public async Task<IActionResult> Unsubscribe(PushSubscriptionRequest request)
    {
        var subscription = await db.PushSubscriptions.SingleOrDefaultAsync(
            item => item.UserId == UserId && item.Endpoint == request.Endpoint);

        if (subscription is not null)
        {
            db.PushSubscriptions.Remove(subscription);
            await db.SaveChangesAsync();
        }

        return NoContent();
    }

    [HttpPost("push/test")]
    public async Task<IActionResult> SendTestPush()
    {
        if (string.IsNullOrWhiteSpace(config["WebPush:PublicKey"])
            || string.IsNullOrWhiteSpace(config["WebPush:PrivateKey"]))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                message = "Browser push is not configured on the API. Configure WebPush:PublicKey and WebPush:PrivateKey."
            });
        }

        var sent = await push.SendToUsersAsync(
            [UserId],
            "TENDED test notification",
            "Browser notifications are connected to your medication reminders.",
            "test_notification",
            cancellationToken: HttpContext.RequestAborted);

        if (!sent)
        {
            return BadRequest(new
            {
                message = "The API could not deliver a push notification. Enable browser notifications on this device and verify the VAPID keys and subscription."
            });
        }

        return Ok(new { status = "sent", message = "Test notification sent to this browser." });
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var rows = await db.Notifications
            .Where(notification => notification.UserId == UserId)
            .OrderByDescending(notification => notification.CreatedAt)
            .Take(100)
            .ToListAsync();

        return Ok(rows);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var notification = await db.Notifications.SingleOrDefaultAsync(
            item => item.Id == id && item.UserId == UserId);

        if (notification is null)
        {
            return NotFound();
        }

        notification.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(notification);
    }
}
