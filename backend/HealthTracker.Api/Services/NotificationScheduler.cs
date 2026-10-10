using System.Text.Json;
using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;
/// <summary>
/// Background service that sends dose reminders, "due now", missed-dose and refill alerts.
/// </summary>
/// <remarks>
/// Runs every 20 seconds when <c>NotificationRuntimeConfig.ActiveProvider</c> is <c>dotnet</c>
/// (a Go implementation can take over by switching the provider). Each tick uses its own DI
/// scope, so it leases a pooled <c>AppDbContext</c> backed by the shared connection pool.
/// Deliveries are reserved in <c>NotificationDeliveries</c> before sending so each reminder is
/// sent at most once even if ticks overlap or the service restarts.
/// </remarks>
/// <param name="scopes">Creates a DI scope per tick.</param>
/// <param name="log">Logger.</param>
public class NotificationScheduler(IServiceScopeFactory scopes, ILogger<NotificationScheduler> log) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(20);

    /// <summary>
    /// Main loop: waits one interval after startup, then runs a tick every interval until shutdown.
    /// Errors are logged and the loop continues.
    /// </summary>
    /// <param name="stoppingToken">Signals application shutdown.</param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(PollInterval, stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await Tick(scope.ServiceProvider, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Notification scheduler failed");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }
    }

    /// <summary>
    /// One scheduling pass over every user and every patient they can access.
    /// </summary>
    /// <param name="services">Scoped service provider for this tick.</param>
    /// <param name="cancellationToken">Shutdown token.</param>
    private static async Task Tick(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var access = services.GetRequiredService<IPatientAccessService>();
        var schedulerProvider = await db.Database.SqlQueryRaw<string>("""
                SELECT "ActiveProvider" AS "Value"
                FROM "NotificationRuntimeConfig"
                WHERE "Id" = 1 AND "Enabled" = TRUE
                """).FirstOrDefaultAsync(cancellationToken);
        if (!string.Equals(schedulerProvider, "dotnet", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var push = services.GetRequiredService<IPushNotificationService>();
        var now = DateTimeOffset.UtcNow;
        var users = await db.Users.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var user in users)
        {
            var timeZone = DoseSchedule.ResolveTimeZone(user.TimeZoneId);
            var localNow = TimeZoneInfo.ConvertTime(now, timeZone);
            var localDate = DateOnly.FromDateTime(localNow.DateTime);
            var ownerIds = await access.GetAccessibleOwnerIdsAsync(user.Id, cancellationToken);
            var patients = await db.Patients.Where(patient => ownerIds.Contains(patient.UserId)).ToListAsync(cancellationToken);
            foreach (var patient in patients)
            {
                var medicines = await db.Medicines.Where(medicine => medicine.PatientId == patient.Id).ToListAsync(cancellationToken);
                foreach (var medicine in medicines)
                {
                    await SendRefillReminderIfNeeded(db, push, user, patient, medicine, localDate, timeZone, cancellationToken);
                    if (!DoseSchedule.Occurs(medicine, localDate))
                    {
                        continue;
                    }

                    var doseTimes = DoseSchedule.Times(medicine);
                    foreach (var doseTime in doseTimes)
                    {
                        if (!TimeOnly.TryParse(doseTime, out var timeOfDay))
                        {
                            continue;
                        }

                        var scheduledLocal = localDate.ToDateTime(timeOfDay, DateTimeKind.Unspecified);
                        var scheduledUtc = new DateTimeOffset(scheduledLocal, timeZone.GetUtcOffset(scheduledLocal)).ToUniversalTime();
                        var dose = await db.DoseEvents.SingleOrDefaultAsync(item => item.PatientId == patient.Id && item.MedicineId == medicine.Id && item.Date == localDate && item.Time == doseTime, cancellationToken);
                        if (dose is null)
                        {
                            dose = new DoseEvent
                            {
                                PatientId = patient.Id,
                                MedicineId = medicine.Id,
                                Date = localDate,
                                Time = doseTime
                            };
                            db.DoseEvents.Add(dose);
                            await db.SaveChangesAsync(cancellationToken);
                        }

                        if (dose.Status is "taken" or "skipped" or "rescheduled")
                        {
                            continue;
                        }

                        var minutesUntilDose = (scheduledUtc - now).TotalMinutes;
                        if (minutesUntilDose > 0 && user.NotificationLeadMinutes > 0 && minutesUntilDose <= user.NotificationLeadMinutes)
                        {
                            var repeatMinutes = Math.Max(1, user.NotificationRepeatMinutes);
                            var elapsedMinutes = user.NotificationLeadMinutes - minutesUntilDose;
                            var slot = (int)Math.Floor(elapsedMinutes / repeatMinutes);
                            var occurrenceUtc = scheduledUtc.AddMinutes(-user.NotificationLeadMinutes + slot * repeatMinutes).ToUniversalTime();
                            if (occurrenceUtc <= now && await Reserve(db, user.Id, dose.Id, "reminder", occurrenceUtc, cancellationToken))
                            {
                                await Deliver(db, user.Id, patient, medicine, dose, "Medicine reminder", $"{medicine.Name} ({medicine.Strength}) for {patient.Name} is due at {timeOfDay}.", "dose_reminder", occurrenceUtc, push, cancellationToken);
                            }
                        }

                        if (user.FinalNotificationEnabled && minutesUntilDose <= 0 && minutesUntilDose >= -1.0 && await Reserve(db, user.Id, dose.Id, "final", scheduledUtc, cancellationToken))
                        {
                            await Deliver(db, user.Id, patient, medicine, dose, "Medicine due now", $"{medicine.Name} ({medicine.Strength}) for {patient.Name} is due now.", "dose_final", scheduledUtc, push, cancellationToken);
                        }

                        if (minutesUntilDose <= 0 && dose.Status == "pending")
                        {
                            dose.Status = "missed";
                            dose.MissedAt = now;
                            await db.SaveChangesAsync(cancellationToken);
                        }

                        if (minutesUntilDose <= -1.0 && dose.Status == "missed" && await Reserve(db, user.Id, dose.Id, "missed", scheduledUtc, cancellationToken))
                        {
                            await Deliver(db, user.Id, patient, medicine, dose, "Dose missed", $"{medicine.Name} ({medicine.Strength}) for {patient.Name} was not marked taken at {timeOfDay}.", "dose_missed", scheduledUtc, push, cancellationToken);
                        }
                    }
                }
            }
        }
    }

    /// <summary>
    /// Sends at most one refill reminder per medicine per local day when supply is at or below the threshold.
    /// </summary>
    private static async Task SendRefillReminderIfNeeded(AppDbContext db, IPushNotificationService push, AppUser user, Patient patient, Medicine medicine, DateOnly localDate, TimeZoneInfo timeZone, CancellationToken cancellationToken)
    {
        if (!medicine.IsRecurring || medicine.SupplyCount > medicine.RefillThreshold)
        {
            return;
        }

        var localMidnight = localDate.ToDateTime(TimeOnly.MinValue);
        var startUtc = new DateTimeOffset(localMidnight, timeZone.GetUtcOffset(localMidnight)).ToUniversalTime();
        var alreadyNotified = await db.Notifications.AnyAsync(notification => notification.UserId == user.Id && notification.Type == "refill_low" && notification.CreatedAt >= startUtc && notification.DataJson.Contains(medicine.Id.ToString()), cancellationToken);
        if (alreadyNotified)
        {
            return;
        }

        db.Notifications.Add(new AppNotification { UserId = user.Id, Type = "refill_low", Title = "Refill reminder", Message = $"{medicine.Name} for {patient.Name} has {medicine.SupplyCount} doses remaining. Refill threshold: {medicine.RefillThreshold} doses.", DataJson = JsonSerializer.Serialize(new { medicineId = medicine.Id, medicineName = medicine.Name, patientId = patient.Id, patientName = patient.Name, dosesRemaining = medicine.SupplyCount, refillThreshold = medicine.RefillThreshold }) });
        await db.SaveChangesAsync(cancellationToken);
        await push.SendToUsersAsync([user.Id], "Refill reminder", $"{medicine.Name} for {patient.Name} has {medicine.SupplyCount} doses remaining. Refill threshold: {medicine.RefillThreshold} doses.", "refill_low", null, cancellationToken, medicine.Form);
    }

    /// <summary>
    /// Sends a reserved reminder via Web Push, records the delivery outcome and stores the in-app
    /// notification (plus a "not delivered" notice when push fails).
    /// </summary>
    private static async Task Deliver(AppDbContext db, Guid userId, Patient patient, Medicine medicine, DoseEvent dose, string title, string body, string type, DateTimeOffset occurrenceUtc, IPushNotificationService push, CancellationToken cancellationToken)
    {
        occurrenceUtc = occurrenceUtc.ToUniversalTime();
        var sent = await push.SendToUsersAsync([userId], title, body, type, dose.Id, cancellationToken, medicine.Form);
        var delivery = await db.NotificationDeliveries.SingleAsync(item => item.UserId == userId && item.DoseEventId == dose.Id && item.Type == type && item.ScheduledFor == occurrenceUtc, cancellationToken);
        delivery.SentAt = sent ? DateTimeOffset.UtcNow : null;
        delivery.Status = sent ? "sent" : "failed";
        delivery.Error = sent ? null : "No active browser push subscription or delivery failed.";
        db.Notifications.Add(new AppNotification { UserId = userId, Type = type, Title = title, Message = body, DataJson = JsonSerializer.Serialize(new { doseId = dose.Id, patientId = patient.Id, medicineId = medicine.Id, medicineForm = medicine.Form, type, deliveryStatus = sent ? "sent" : "failed" }) });
        if (!sent)
        {
            db.Notifications.Add(new AppNotification { UserId = userId, Type = "notification_failed", Title = "Browser notification not delivered", Message = $"{title}: {medicine.Name} for {patient.Name}. Enable browser notifications or check the push subscription.", DataJson = JsonSerializer.Serialize(new { doseId = dose.Id, type }) });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Claims a (user, dose, type, time) delivery slot; returns false if it was already claimed.
    /// </summary>
    private static async Task<bool> Reserve(AppDbContext db, Guid userId, Guid doseId, string type, DateTimeOffset occurrenceUtc, CancellationToken cancellationToken)
    {
        occurrenceUtc = occurrenceUtc.ToUniversalTime();
        var alreadyReserved = await db.NotificationDeliveries.AnyAsync(item => item.UserId == userId && item.DoseEventId == doseId && item.Type == type && item.ScheduledFor == occurrenceUtc, cancellationToken);
        if (alreadyReserved)
        {
            return false;
        }

        db.NotificationDeliveries.Add(new NotificationDelivery { UserId = userId, DoseEventId = doseId, Type = type, ScheduledFor = occurrenceUtc });
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
