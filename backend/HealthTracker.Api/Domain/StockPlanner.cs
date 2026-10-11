using HealthTracker.Api.Models;

namespace HealthTracker.Api.Domain;

/// <summary>Stock projection for one medicine.</summary>
/// <param name="PerDose">Quantity taken per dose (e.g. 0.5 tablet).</param>
/// <param name="Unit">Stock unit.</param>
/// <param name="DosesPerDay">Average scheduled doses per day over the window.</param>
/// <param name="QuantityPerDay">Average quantity used per day.</param>
/// <param name="DosesLeft">Whole doses the current stock covers.</param>
/// <param name="DaysLeft">Days until stock runs out (null when it outlasts the horizon or the course).</param>
/// <param name="RunOutDate">First day stock is insufficient (null when not within the horizon).</param>
/// <param name="QuantityNeeded">Quantity required for the requested window.</param>
/// <param name="QuantityToBuy">Shortfall for the window (0 when covered).</param>
/// <param name="Status"><c>out</c>, <c>critical</c>, <c>low</c> or <c>ok</c>.</param>
/// <param name="Insufficient">True when stock won't cover the requested window.</param>
public record StockProjection(decimal PerDose, string Unit, decimal DosesPerDay, decimal QuantityPerDay, int DosesLeft, int? DaysLeft, DateOnly? RunOutDate, decimal QuantityNeeded, decimal QuantityToBuy, string Status, bool Insufficient);

/// <summary>
/// Projects stock day by day using the real schedule: frequency pattern (daily, alternate days,
/// specific weekdays, cycles), dose times, dose amount, pauses and course end — so a medicine
/// that is paused or ends before day N only needs stock for the days it actually runs.
/// </summary>
public static class StockPlanner
{
    /// <summary>How far ahead run-out dates are searched.</summary>
    public const int HorizonDays = 400;

    /// <summary>
    /// Projects stock for a window of <paramref name="days"/> days starting today.
    /// </summary>
    /// <param name="m">Medicine.</param>
    /// <param name="today">Today in the owner's time zone.</param>
    /// <param name="dosesRemainingToday">Doses still to take today (already-taken ones are excluded).</param>
    /// <param name="days">Window length (1 = today only).</param>
    public static StockProjection Project(Medicine m, DateOnly today, int dosesRemainingToday, int days)
    {
        var (perDose, unit) = DoseQuantity.Parse(m.DoseAmount, m.Form);
        var timesPerDay = DoseSchedule.Times(m).Count;
        int DosesOn(DateOnly d) => d == today ? Math.Min(dosesRemainingToday, DoseSchedule.Occurs(m, d) ? timesPerDay : 0)
            : DoseSchedule.Occurs(m, d) ? timesPerDay : 0;

        days = Math.Clamp(days, 1, 365);
        var windowDoses = 0;
        for (var i = 0; i < days; i++)
            windowDoses += DosesOn(today.AddDays(i));
        var needed = windowDoses * perDose;

        var stock = m.StockQuantity;
        DateOnly? runOut = null;
        var remaining = stock;
        for (var i = 0; i < HorizonDays; i++)
        {
            var d = today.AddDays(i);
            var use = DosesOn(d) * perDose;
            if (use > remaining)
            {
                runOut = d;
                break;
            }

            remaining -= use;
        }

        var daysLeft = runOut.HasValue ? runOut.Value.DayNumber - today.DayNumber : (int?)null;
        var dosesLeft = perDose > 0 ? (int)Math.Floor(stock / perDose) : 0;
        var avgDoses = days > 0 ? Math.Round((decimal)windowDoses / days, 2) : 0;
        var toBuy = Math.Max(0, needed - stock);
        var status = stock < perDose ? "out"
            : (daysLeft is <= 3) || (m.RefillThreshold > 0 && dosesLeft <= Math.Max(1, m.RefillThreshold / 2)) ? "critical"
            : (daysLeft is <= 7) || dosesLeft <= m.RefillThreshold ? "low"
            : "ok";
        return new StockProjection(perDose, unit, avgDoses, Math.Round(avgDoses * perDose, 3), dosesLeft, daysLeft, runOut,
            Math.Round(needed, 3), Math.Round(toBuy, 3), status, needed > stock);
    }

    /// <summary>Keeps the legacy dose counter in sync with quantity stock.</summary>
    public static void SyncDoses(Medicine m)
    {
        var (perDose, _) = DoseQuantity.Parse(m.DoseAmount, m.Form);
        m.SupplyCount = perDose > 0 ? (int)Math.Floor(m.StockQuantity / perDose) : 0;
    }
}
