using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HealthTracker.Tests;

/// <summary>Scheduling rules shared by the dose service and the notification scheduler.</summary>
public class DoseScheduleTests
{
    static readonly DateOnly Start = new(2026, 10, 5); // a Monday

    /// <summary>Builds a medicine starting on <see cref="Start"/>.</summary>
    static Medicine Med(string pattern = "daily", string days = "[]", int every = 1, string unit = "days") => new()
    {
        StartDate = Start,
        FrequencyPattern = pattern,
        SpecificDaysJson = days,
        CycleEvery = every,
        CycleUnit = unit
    };

    [Fact]
    public void DailyOccursFromStartDate()
    {
        Assert.False(DoseSchedule.Occurs(Med(), Start.AddDays(-1)));
        Assert.True(DoseSchedule.Occurs(Med(), Start));
        Assert.True(DoseSchedule.Occurs(Med(), Start.AddDays(10)));
    }

    [Fact]
    public void EveryOtherDayAlternates()
    {
        Assert.True(DoseSchedule.Occurs(Med("everyOtherDay"), Start.AddDays(2)));
        Assert.False(DoseSchedule.Occurs(Med("everyOtherDay"), Start.AddDays(3)));
    }

    [Fact]
    public void SpecificDaysMatchWeekday()
    {
        var m = Med("specificDays", "[\"Mon\",\"Thu\"]");
        Assert.True(DoseSchedule.Occurs(m, Start));
        Assert.False(DoseSchedule.Occurs(m, Start.AddDays(1)));
        Assert.True(DoseSchedule.Occurs(m, Start.AddDays(3)));
    }

    [Fact]
    public void PauseRangeIsInclusiveAndOpenEndedWithoutEndDate()
    {
        var m = Med();
        m.PauseStartDate = Start.AddDays(2);
        Assert.True(DoseSchedule.Occurs(m, Start.AddDays(1)));
        Assert.False(DoseSchedule.Occurs(m, Start.AddDays(2)));
        Assert.False(DoseSchedule.Occurs(m, Start.AddDays(30)));
        m.PauseEndDate = Start.AddDays(3);
        Assert.True(DoseSchedule.Occurs(m, Start.AddDays(4)));
    }

    [Fact]
    public void FiniteDurationStops()
    {
        var m = Med();
        m.DurationType = "fixed";
        m.DurationValue = 1;
        m.DurationUnit = "weeks";
        Assert.True(DoseSchedule.Occurs(m, Start.AddDays(6)));
        Assert.False(DoseSchedule.Occurs(m, Start.AddDays(7)));
    }

    [Fact]
    public void UnknownTimeZoneFallsBackToDefault()
    {
        Assert.Equal(TimeZoneInfo.FindSystemTimeZoneById(DoseSchedule.DefaultTimeZoneId), DoseSchedule.ResolveTimeZone("Not/AZone"));
        Assert.Equal(TimeZoneInfo.FindSystemTimeZoneById(DoseSchedule.DefaultTimeZoneId), DoseSchedule.ResolveTimeZone(null));
    }

    [Theory]
    [InlineData("08:00", "Morning")]
    [InlineData("13:00", "Noon")]
    [InlineData("20:00", "Evening")]
    [InlineData("22:30", "Night")]
    public void DayPartBuckets(string time, string expected) => Assert.Equal(expected, DoseSchedule.DayPart(time));

    [Fact]
    public void PostgresUrlIsConvertedToConnectionString()
    {
        var cs = ConnectionStringResolver.FromUri("postgres://app:p%40ss@db.example.com:6543/tended");
        Assert.Contains("Host=db.example.com", cs);
        Assert.Contains("Port=6543", cs);
        Assert.Contains("Database=tended", cs);
        Assert.Contains("Password=p@ss", cs);
        Assert.Contains("SSL Mode=Require", cs);
    }

    [Fact]
    public void MissingConnectionStringThrows()
    {
        var config = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => ConnectionStringResolver.Resolve(config));
    }
}
