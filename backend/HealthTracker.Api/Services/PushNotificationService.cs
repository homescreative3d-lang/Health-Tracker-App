using System.Text.Json;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace HealthTracker.Api.Services;
/// <summary>
/// Delivers Web Push notifications to users' subscribed devices.
/// </summary>
public interface IPushNotificationService
{
    /// <summary>
    /// Sends a push to every subscribed device of each user; expired subscriptions are removed.
    /// </summary>
    /// <param name="userIds">Recipients.</param>
    /// <param name="title">Notification title.</param>
    /// <param name="body">Notification text.</param>
    /// <param name="type">Type code used by the service worker (e.g. <c>dose_reminder</c>).</param>
    /// <param name="doseId">Dose the notification's Take/Skip actions apply to.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <param name="medicineForm">Medicine form, used to pick the notification icon.</param>
    /// <returns><c>true</c> when at least one device accepted the push.</returns>
    Task<bool> SendToUsersAsync(IEnumerable<Guid> userIds, string title, string body, string type, Guid? doseId = null, CancellationToken ct = default, string? medicineForm = null);
}

/// <summary>
/// VAPID Web Push implementation configured by <c>WebPush:PublicKey</c>, <c>WebPush:PrivateKey</c> and <c>WebPush:Subject</c>.
/// </summary>
public class PushNotificationService(AppDbContext db, IConfiguration config, ILogger<PushNotificationService> log) : IPushNotificationService
{
    /// <inheritdoc />
    public async Task<bool> SendToUsersAsync(IEnumerable<Guid> userIds, string title, string body, string type, Guid? doseId = null, CancellationToken ct = default, string? medicineForm = null)
    {
        var pub = config["WebPush:PublicKey"];
        var priv = config["WebPush:PrivateKey"];
        if (string.IsNullOrWhiteSpace(pub) || string.IsNullOrWhiteSpace(priv))
        {
            log.LogWarning("Web Push is not configured.");
            return false;
        }

        var any = false;
        var client = new WebPushClient();
        foreach (var uid in userIds.Distinct())
        {
            var subs = await db.PushSubscriptions.Where(x => x.UserId == uid).ToListAsync(ct);
            var sentForUser = false;
            foreach (var s in subs)
            {
                try
                {
                    await client.SendNotificationAsync(new WebPush.PushSubscription(s.Endpoint, s.P256dh, s.Auth), JsonSerializer.Serialize(new { title, body, type, doseId, url = "/", form = medicineForm }), new VapidDetails(config["WebPush:Subject"] ?? "mailto:notifications@tended.app", pub, priv));
                    s.UpdatedAt = DateTimeOffset.UtcNow;
                    sentForUser = true;
                    any = true;
                }
                catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
                {
                    db.PushSubscriptions.Remove(s);
                }
                catch (Exception ex)
                {
                    log.LogWarning(ex, "Push delivery failed for {UserId}", uid);
                }
            }

            if (!sentForUser)
                log.LogInformation("No successful push subscription for {UserId}", uid);
        }

        await db.SaveChangesAsync(ct);
        return any;
    }
}
