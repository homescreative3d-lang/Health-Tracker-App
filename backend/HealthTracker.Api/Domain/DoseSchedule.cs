using System.Text.Json;
using HealthTracker.Api.Models;

namespace HealthTracker.Api.Domain;

/// <summary>
/// Single source of truth for medicine scheduling rules.
/// </summary>
/// <remarks>
/// <c>DoseService</c> and <c>NotificationScheduler</c> previously each had their own copy of
/// these rules; a change to one could silently desynchronize reminders from the schedule.
/// Behavior is identical to the previous implementations.
/// </remarks>
public static class DoseSchedule
{
    /// <summary>Default time zone used when a user's zone is missing or invalid.</summary>
    public const string DefaultTimeZoneId = "Asia/Kolkata";

    /// <summary>Minutes after the scheduled time during which a dose may be taken, skipped or undone.</summary>
    public const int ActionWindowMinutes = 60;

    /// <summary>
    /// Decides whether a medicine has doses on a date, honoring start date, pause range,
    /// one-off medicines, finite durations and the frequency pattern.
    /// </summary>
    /// <param name="medicine">The medicine.</param>
    /// <param name="date">The calendar date in the owner's time zone.</param>
    /// <returns><c>true</c> when doses are scheduled on <paramref name="date"/>.</returns>
    public static bool Occurs(Medicine medicine, DateOnly date)
    {
        if (date < medicine.StartDate || IsPaused(medicine, date))
            return false;
        // A rescheduled medicine hands over to its replacement from EndedOn onwards.
        if (medicine.EndedOn.HasValue && date >= medicine.EndedOn.Value)
            return false;
        var daysSinceStart = date.DayNumber - medicine.StartDate.DayNumber;
        if (!medicine.IsRecurring && daysSinceStart != 0)
            return false;
        if (medicine.DurationType != "ongoing" && daysSinceStart >= DurationInDays(medicine))
            return false;
        return medicine.FrequencyPattern switch
        {
            "daily" => true,
            "everyOtherDay" => daysSinceStart % 2 == 0,
            "specificDays" => SpecificDays(medicine).Contains(date.DayOfWeek.ToString()[..3], StringComparer.OrdinalIgnoreCase),
            "recurringCycle" when medicine.CycleUnit == "weeks" => daysSinceStart % (Math.Max(1, medicine.CycleEvery) * 7) == 0,
            "recurringCycle" when medicine.CycleUnit == "months" => date.Day == medicine.StartDate.Day,
            "recurringCycle" => daysSinceStart % Math.Max(1, medicine.CycleEvery) == 0,
            _ => false
        };
    }

    /// <summary>
    /// Returns whether the medicine is paused on a date (inclusive range; open-ended when no end date).
    /// </summary>
    /// <param name="medicine">The medicine.</param>
    /// <param name="date">The date to test.</param>
    public static bool IsPaused(Medicine medicine, DateOnly date) =>
        medicine.PauseStartDate.HasValue
        && date >= medicine.PauseStartDate.Value
        && (!medicine.PauseEndDate.HasValue || date <= medicine.PauseEndDate.Value);

    /// <summary>
    /// Converts a finite duration to days (weeks = 7, months = 30).
    /// </summary>
    /// <param name="medicine">The medicine.</param>
    public static int DurationInDays(Medicine medicine) => medicine.DurationUnit switch
    {
        "weeks" => medicine.DurationValue * 7,
        "months" => medicine.DurationValue * 30,
        _ => medicine.DurationValue
    };

    /// <summary>
    /// Returns the dose times configured for a medicine (de-duplicated).
    /// </summary>
    /// <param name="medicine">The medicine.</param>
    public static IReadOnlyList<string> Times(Medicine medicine) =>
        (JsonSerializer.Deserialize<List<string>>(medicine.TimesJson) ?? []).Distinct().ToList();

    /// <summary>
    /// Converts a dose's local date and time to an absolute instant in the given time zone.
    /// </summary>
    /// <param name="date">Local date.</param>
    /// <param name="time">Local time in <c>HH:mm</c>.</param>
    /// <param name="zone">The owner's time zone.</param>
    public static DateTimeOffset ScheduledAt(DateOnly date, string time, TimeZoneInfo zone)
    {
        var local = date.ToDateTime(TimeOnly.Parse(time), DateTimeKind.Unspecified);
        return new DateTimeOffset(local, zone.GetUtcOffset(local));
    }

    /// <summary>
    /// Finds a time zone by id, falling back to <see cref="DefaultTimeZoneId"/> for missing or unknown ids.
    /// </summary>
    /// <param name="timeZoneId">IANA/Windows time zone id.</param>
    public static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(timeZoneId) ? DefaultTimeZoneId : timeZoneId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById(DefaultTimeZoneId);
        }
    }

    /// <summary>
    /// Returns "today" in a time zone.
    /// </summary>
    /// <param name="zone">The time zone.</param>
    public static DateOnly LocalToday(TimeZoneInfo zone) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime);

    /// <summary>
    /// Maps a dose time to the history filter buckets: Morning (&lt;11:30), Noon (&lt;17:00), Evening (&lt;21:00), Night.
    /// </summary>
    /// <param name="time">Time in <c>HH:mm</c>; unparseable values map to Night.</param>
    public static string DayPart(string time)
    {
        if (!TimeSpan.TryParse(time, out var t))
            return "Night";
        var minutes = t.Hours * 60 + t.Minutes;
        return minutes < 690 ? "Morning" : minutes < 1020 ? "Noon" : minutes < 1260 ? "Evening" : "Night";
    }

    /// <summary>Reads the weekday codes for "specificDays" medicines.</summary>
    private static List<string> SpecificDays(Medicine medicine) =>
        JsonSerializer.Deserialize<List<string>>(medicine.SpecificDaysJson) ?? [];
}
