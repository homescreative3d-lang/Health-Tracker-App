using System.Text.Json;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

public class NotificationScheduler(
    IServiceScopeFactory scopes,
    ILogger<NotificationScheduler> log) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);

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

    private static async Task Tick(IServiceProvider services, CancellationToken cancellationToken)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var schedulerProvider = await db.Database
            .SqlQueryRaw<string>(
                """
                SELECT "Value" AS "Value"
                FROM "NotificationRuntimeConfig"
                WHERE "Key" = 'NotificationSchedulerProvider'
                """)
            .FirstOrDefaultAsync(cancellationToken);

        if (!string.Equals(schedulerProvider, "dotnet", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var push = services.GetRequiredService<IPushNotificationService>();
        var now = DateTimeOffset.UtcNow;
        var users = await db.Users.AsNoTracking().ToListAsync(cancellationToken);

        foreach (var user in users)
        {
            var timeZone = GetTimeZone(user.TimeZoneId);
            var localNow = TimeZoneInfo.ConvertTime(now, timeZone);
            var localDate = DateOnly.FromDateTime(localNow.DateTime);
            var ownerIds = await GetAccessibleOwnerIds(db, user.Id, cancellationToken);
            var patients = await db.Patients
                .Where(patient => ownerIds.Contains(patient.UserId))
                .ToListAsync(cancellationToken);

            foreach (var patient in patients)
            {
                var medicines = await db.Medicines
                    .Where(medicine => medicine.PatientId == patient.Id)
                    .ToListAsync(cancellationToken);

                foreach (var medicine in medicines)
                {
                    await SendRefillReminderIfNeeded(
                        db, push, user, patient, medicine, localDate, timeZone, cancellationToken);

                    if (!Occurs(medicine, localDate))
                    {
                        continue;
                    }

                    var doseTimes = JsonSerializer.Deserialize<List<string>>(medicine.TimesJson) ?? [];

                    foreach (var doseTime in doseTimes)
                    {
                        if (!TimeOnly.TryParse(doseTime, out var timeOfDay))
                        {
                            continue;
                        }

                        var scheduledLocal = localDate.ToDateTime(timeOfDay, DateTimeKind.Unspecified);
                        var scheduledUtc = new DateTimeOffset(
                            scheduledLocal,
                            timeZone.GetUtcOffset(scheduledLocal)).ToUniversalTime();

                        var dose = await db.DoseEvents.SingleOrDefaultAsync(
                            item => item.PatientId == patient.Id
                                && item.MedicineId == medicine.Id
                                && item.Date == localDate
                                && item.Time == doseTime,
                            cancellationToken);

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

                        if (minutesUntilDose > 0
                            && user.NotificationLeadMinutes > 0
                            && minutesUntilDose <= user.NotificationLeadMinutes)
                        {
                            var repeatMinutes = Math.Max(1, user.NotificationRepeatMinutes);
                            var elapsedMinutes = user.NotificationLeadMinutes - minutesUntilDose;
                            var slot = (int)Math.Floor(elapsedMinutes / repeatMinutes);
                            var occurrenceUtc = scheduledUtc
                                .AddMinutes(-user.NotificationLeadMinutes + slot * repeatMinutes)
                                .ToUniversalTime();

                            if (occurrenceUtc <= now
                                && await Reserve(
                                    db, user.Id, dose.Id, "reminder", occurrenceUtc, cancellationToken))
                            {
                                await Deliver(
                                    db,
                                    user.Id,
                                    patient,
                                    medicine,
                                    dose,
                                    "Medicine reminder",
                                    $"{medicine.Name} ({medicine.Strength}) for {patient.Name} is due at {timeOfDay}.",
                                    "dose_reminder",
                                    occurrenceUtc,
                                    push,
                                    cancellationToken);
                            }
                        }

                        if (user.FinalNotificationEnabled
                            && minutesUntilDose <= 0
                            && minutesUntilDose >= -1.0
                            && await Reserve(
                                db, user.Id, dose.Id, "final", scheduledUtc, cancellationToken))
                        {
                            await Deliver(
                                db,
                                user.Id,
                                patient,
                                medicine,
                                dose,
                                "Medicine due now",
                                $"{medicine.Name} ({medicine.Strength}) for {patient.Name} is due now.",
                                "dose_final",
                                scheduledUtc,
                                push,
                                cancellationToken);
                        }

                        if (minutesUntilDose <= 0 && dose.Status == "pending")
                        {
                            dose.Status = "missed";
                            dose.MissedAt = now;
                            await db.SaveChangesAsync(cancellationToken);
                        }

                        if (minutesUntilDose <= -1.0
                            && dose.Status == "missed"
                            && await Reserve(
                                db, user.Id, dose.Id, "missed", scheduledUtc, cancellationToken))
                        {
                            await Deliver(
                                db,
                                user.Id,
                                patient,
                                medicine,
                                dose,
                                "Dose missed",
                                $"{medicine.Name} ({medicine.Strength}) for {patient.Name} was not marked taken at {timeOfDay}.",
                                "dose_missed",
                                scheduledUtc,
                                push,
                                cancellationToken);
                        }
                    }
                }
            }
        }
    }

    private static async Task SendRefillReminderIfNeeded(
        AppDbContext db,
        IPushNotificationService push,
        AppUser user,
        Patient patient,
        Medicine medicine,
        DateOnly localDate,
        TimeZoneInfo timeZone,
        CancellationToken cancellationToken)
    {
        if (!medicine.IsRecurring || medicine.SupplyCount > medicine.RefillThreshold)
        {
            return;
        }

        var localMidnight = localDate.ToDateTime(TimeOnly.MinValue);
        var startUtc = new DateTimeOffset(
            localMidnight,
            timeZone.GetUtcOffset(localMidnight)).ToUniversalTime();

        var alreadyNotified = await db.Notifications.AnyAsync(
            notification => notification.UserId == user.Id
                && notification.Type == "refill_low"
                && notification.CreatedAt >= startUtc
                && notification.DataJson.Contains(medicine.Id.ToString()),
            cancellationToken);

        if (alreadyNotified)
        {
            return;
        }

        db.Notifications.Add(new AppNotification
        {
            UserId = user.Id,
            Type = "refill_low",
            Title = "Refill reminder",
            Message = $"{medicine.Name} has {medicine.SupplyCount} doses remaining.",
            DataJson = JsonSerializer.Serialize(new
            {
                medicineId = medicine.Id,
                patientId = patient.Id
            })
        });

        await db.SaveChangesAsync(cancellationToken);

        await push.SendToUsersAsync(
            [user.Id],
            "Refill reminder",
            $"{medicine.Name} for {patient.Name} has {medicine.SupplyCount} doses remaining.",
            "refill_low",
            null,
            cancellationToken,
            medicine.Form);
    }

    private static async Task Deliver(
        AppDbContext db,
        Guid userId,
        Patient patient,
        Medicine medicine,
        DoseEvent dose,
        string title,
        string body,
        string type,
        DateTimeOffset occurrenceUtc,
        IPushNotificationService push,
        CancellationToken cancellationToken)
    {
        occurrenceUtc = occurrenceUtc.ToUniversalTime();

        var sent = await push.SendToUsersAsync(
            [userId], title, body, type, dose.Id, cancellationToken, medicine.Form);

        var delivery = await db.NotificationDeliveries.SingleAsync(
            item => item.UserId == userId
                && item.DoseEventId == dose.Id
                && item.Type == type
                && item.ScheduledFor == occurrenceUtc,
            cancellationToken);

        delivery.SentAt = sent ? DateTimeOffset.UtcNow : null;
        delivery.Status = sent ? "sent" : "failed";
        delivery.Error = sent
            ? null
            : "No active browser push subscription or delivery failed.";

        db.Notifications.Add(new AppNotification
        {
            UserId = userId,
            Type = type,
            Title = title,
            Message = body,
            DataJson = JsonSerializer.Serialize(new
            {
                doseId = dose.Id,
                patientId = patient.Id,
                medicineId = medicine.Id,
                medicineForm = medicine.Form,
                type,
                deliveryStatus = sent ? "sent" : "failed"
            })
        });

        if (!sent)
        {
            db.Notifications.Add(new AppNotification
            {
                UserId = userId,
                Type = "notification_failed",
                Title = "Browser notification not delivered",
                Message = $"{title}: {medicine.Name} for {patient.Name}. Enable browser notifications or check the push subscription.",
                DataJson = JsonSerializer.Serialize(new
                {
                    doseId = dose.Id,
                    type
                })
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<bool> Reserve(
        AppDbContext db,
        Guid userId,
        Guid doseId,
        string type,
        DateTimeOffset occurrenceUtc,
        CancellationToken cancellationToken)
    {
        occurrenceUtc = occurrenceUtc.ToUniversalTime();

        var alreadyReserved = await db.NotificationDeliveries.AnyAsync(
            item => item.UserId == userId
                && item.DoseEventId == doseId
                && item.Type == type
                && item.ScheduledFor == occurrenceUtc,
            cancellationToken);

        if (alreadyReserved)
        {
            return false;
        }

        db.NotificationDeliveries.Add(new NotificationDelivery
        {
            UserId = userId,
            DoseEventId = doseId,
            Type = type,
            ScheduledFor = occurrenceUtc
        });

        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static async Task<List<Guid>> GetAccessibleOwnerIds(
        AppDbContext db,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var ids = await db.FamilyMembers
            .Where(member => member.UserId == userId && member.Status == "approved")
            .Join(
                db.FamilyMembers,
                member => member.FamilyId,
                other => other.FamilyId,
                (_, other) => other.UserId)
            .Distinct()
            .ToListAsync(cancellationToken);

        ids.Add(userId);
        return ids.Distinct().ToList();
    }

    private static TimeZoneInfo GetTimeZone(string? timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(
                string.IsNullOrWhiteSpace(timeZoneId) ? "Asia/Kolkata" : timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata");
        }
    }

    private static bool Occurs(Medicine medicine, DateOnly date)
    {
        if (date < medicine.StartDate
            || (medicine.PauseStartDate.HasValue
                && date >= medicine.PauseStartDate.Value
                && (!medicine.PauseEndDate.HasValue || date <= medicine.PauseEndDate.Value)))
        {
            return false;
        }

        var daysSinceStart = date.DayNumber - medicine.StartDate.DayNumber;

        if (!medicine.IsRecurring && daysSinceStart != 0)
        {
            return false;
        }

        if (medicine.DurationType != "ongoing")
        {
            var durationDays = medicine.DurationUnit switch
            {
                "weeks" => medicine.DurationValue * 7,
                "months" => medicine.DurationValue * 30,
                _ => medicine.DurationValue
            };

            if (daysSinceStart >= durationDays)
            {
                return false;
            }
        }

        return medicine.FrequencyPattern switch
        {
            "daily" => true,
            "everyOtherDay" => daysSinceStart % 2 == 0,
            "specificDays" => (JsonSerializer.Deserialize<List<string>>(medicine.SpecificDaysJson) ?? [])
                .Contains(date.DayOfWeek.ToString()[..3], StringComparer.OrdinalIgnoreCase),
            "recurringCycle" when medicine.CycleUnit == "weeks" =>
                daysSinceStart % (Math.Max(1, medicine.CycleEvery) * 7) == 0,
            "recurringCycle" when medicine.CycleUnit == "months" =>
                date.Day == medicine.StartDate.Day,
            "recurringCycle" =>
                daysSinceStart % Math.Max(1, medicine.CycleEvery) == 0,
            _ => false
        };
    }
}
