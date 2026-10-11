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

    /// <summary>
    /// Sends a test push to one user and reports exactly what happened, for the settings screen.
    /// </summary>
    /// <param name="userId">Recipient.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<PushTestResult> SendTestAsync(Guid userId, CancellationToken ct = default);
}

/// <summary>Outcome of a test push.</summary>
/// <param name="Configured">Server VAPID keys are present.</param>
/// <param name="Subscriptions">Subscribed devices before sending.</param>
/// <param name="Delivered">Devices that accepted the push.</param>
/// <param name="Removed">Expired/invalid subscriptions deleted during the attempt.</param>
/// <param name="Reason">Machine-readable failure reason: <c>not_configured</c>, <c>no_subscription</c>, <c>keys_mismatch</c>, <c>expired</c>, <c>error</c>; null on success.</param>
/// <param name="Detail">Push-service error text for troubleshooting.</param>
public record PushTestResult(bool Configured, int Subscriptions, int Delivered, int Removed, string? Reason, string? Detail);

/// <summary>
/// VAPID Web Push implementation configured by <c>WebPush:PublicKey</c>, <c>WebPush:PrivateKey</c> and <c>WebPush:Subject</c>.
/// </summary>
public class PushNotificationService(AppDbContext db, IConfiguration config, ILogger<PushNotificationService> log) : IPushNotificationService
{
    /// <inheritdoc />
    public async Task<bool> SendToUsersAsync(IEnumerable<Guid> userIds, string title, string body, string type, Guid? doseId = null, CancellationToken ct = default, string? medicineForm = null)
    {
        var any = false;
        foreach (var uid in userIds.Distinct())
        {
            var result = await SendCoreAsync(uid, title, body, type, doseId, medicineForm, ct);
            any |= result.Delivered > 0;
            if (result.Delivered == 0 && result.Reason is not null)
                log.LogInformation("Push not delivered to {UserId}: {Reason} {Detail}", uid, result.Reason, result.Detail);
        }

        return any;
    }

    /// <inheritdoc />
    public Task<PushTestResult> SendTestAsync(Guid userId, CancellationToken ct = default) =>
        SendCoreAsync(userId, "Tended test notification", "Browser notifications are connected to your medication reminders.", "test_notification", null, null, ct);

    /// <summary>
    /// Sends to every subscription of one user. Subscriptions the push service reports as gone
    /// (404/410) or as signed with different VAPID keys (401/403) are deleted: they can never
    /// succeed again, and the app re-subscribes automatically with the current key.
    /// </summary>
    private async Task<PushTestResult> SendCoreAsync(Guid uid, string title, string body, string type, Guid? doseId, string? medicineForm, CancellationToken ct)
    {
        var pub = config["WebPush:PublicKey"];
        var priv = config["WebPush:PrivateKey"];
        if (string.IsNullOrWhiteSpace(pub) || string.IsNullOrWhiteSpace(priv))
            return new PushTestResult(false, 0, 0, 0, "not_configured", "WebPush:PublicKey and WebPush:PrivateKey are not set on the server.");
        var subs = await db.PushSubscriptions.Where(x => x.UserId == uid).ToListAsync(ct);
        if (subs.Count == 0)
            return new PushTestResult(true, 0, 0, 0, "no_subscription", null);

        var client = new WebPushClient();
        var vapid = new VapidDetails(config["WebPush:Subject"] ?? "mailto:notifications@tended.app", pub, priv);
        var payload = JsonSerializer.Serialize(new { title, body, type, doseId, url = "/", form = medicineForm });
        int delivered = 0, removed = 0;
        string? reason = null, detail = null;
        foreach (var s in subs)
        {
            try
            {
                await client.SendNotificationAsync(new WebPush.PushSubscription(s.Endpoint, s.P256dh, s.Auth), payload, vapid);
                s.UpdatedAt = DateTimeOffset.UtcNow;
                delivered++;
            }
            catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Gone or System.Net.HttpStatusCode.NotFound)
            {
                db.PushSubscriptions.Remove(s);
                removed++;
                reason ??= "expired";
                detail ??= ex.Message;
            }
            catch (WebPushException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
            {
                db.PushSubscriptions.Remove(s);
                removed++;
                reason = "keys_mismatch";
                detail = ex.Message;
                log.LogWarning("Push rejected for {UserId}: VAPID keys don't match the subscription ({Status}).", uid, ex.StatusCode);
            }
            catch (Exception ex)
            {
                reason ??= "error";
                detail ??= ex.Message;
                log.LogWarning(ex, "Push delivery failed for {UserId}", uid);
            }
        }

        await db.SaveChangesAsync(ct);
        return new PushTestResult(true, subs.Count, delivered, removed, delivered > 0 ? null : reason, delivered > 0 ? null : detail);
    }
}
