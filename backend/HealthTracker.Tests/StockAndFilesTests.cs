using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HealthTracker.Tests;

/// <summary>Dose quantity parsing, stock projection and opaque file links.</summary>
public class StockAndFilesTests
{
    private static readonly DateOnly Today = new(2026, 10, 12); // a Monday

    private static Medicine Med(string dose, decimal stock, string pattern = "daily", string times = "[\"08:00\",\"20:00\"]") => new()
    {
        Name = "Test",
        Form = "Pill",
        DoseAmount = dose,
        StockQuantity = stock,
        StartDate = Today.AddDays(-10),
        FrequencyPattern = pattern,
        TimesJson = times,
        RefillThreshold = 4
    };

    [Theory]
    [InlineData("½ tablet", 0.5, "tablet")]
    [InlineData("1½ tablets", 1.5, "tablet")]
    [InlineData("2 tablets", 2, "tablet")]
    [InlineData("5 ml", 5, "ml")]
    [InlineData("2 puffs", 2, "puff")]
    [InlineData("1/4 tablet", 0.25, "tablet")]
    public void ParsesDoseAmounts(string text, double amount, string unit)
    {
        var (perDose, u) = DoseQuantity.Parse(text, "Pill");
        Assert.Equal((decimal)amount, perDose);
        Assert.Equal(unit, u);
    }

    [Fact]
    public void MissingUnitFallsBackToForm() => Assert.Equal("ml", DoseQuantity.Parse("10", "Syrup").Unit);

    [Fact]
    public void ProjectsRunOutDate()
    {
        // ½ tablet twice a day = 1 tablet/day; 3 tablets cover today + 2 more days.
        var p = StockPlanner.Project(Med("½ tablet", 3), Today, 2, 7);
        Assert.Equal(Today.AddDays(3), p.RunOutDate);
        Assert.Equal(3, p.DaysLeft);
        Assert.Equal(7m, p.QuantityNeeded);
        Assert.Equal(4m, p.QuantityToBuy);
        Assert.True(p.Insufficient);
        Assert.Equal(6, p.DosesLeft);
    }

    [Fact]
    public void EveryOtherDayHalvesNeed()
    {
        var m = Med("1 tablet", 100, "everyOtherDay", "[\"08:00\"]");
        m.StartDate = Today; // runs today, +2, +4, +6
        var p = StockPlanner.Project(m, Today, 1, 7);
        Assert.Equal(4m, p.QuantityNeeded);
        Assert.False(p.Insufficient);
    }

    [Fact]
    public void PausedDaysNeedNoStock()
    {
        var m = Med("1 tablet", 2, times: "[\"08:00\"]");
        m.PauseStartDate = Today.AddDays(2);
        var p = StockPlanner.Project(m, Today, 1, 7);
        Assert.Equal(2m, p.QuantityNeeded); // today + tomorrow only
        Assert.False(p.Insufficient);
    }

    [Fact]
    public void CourseEndingEarlyLimitsNeed()
    {
        var m = Med("1 tablet", 1, times: "[\"08:00\"]");
        m.StartDate = Today;
        m.DurationType = "fixed";
        m.DurationValue = 2;
        m.DurationUnit = "days";
        Assert.Equal(2m, StockPlanner.Project(m, Today, 1, 30).QuantityNeeded);
    }

    [Fact]
    public void OutOfStockStatus() => Assert.Equal("out", StockPlanner.Project(Med("1 tablet", 0.5m), Today, 2, 1).Status);

    [Fact]
    public void FileLinksRoundTripAndHidePaths()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Api:PublicUrl"] = "https://api.example.com" }).Build();
        var links = new FileLinks(new HttpContextAccessor(), config);
        links.UseKey(new byte[32]);
        var url = links.Link("patient", "records/123/secret-path.pdf", "prescription.pdf");
        Assert.True(url.StartsWith("https://api.example.com/api/files/"));
        Assert.False(url.Contains("secret-path"));
        var ticket = links.Read(url.Split('/').Last());
        Assert.NotNull(ticket);
        Assert.Equal("records/123/secret-path.pdf", ticket!.K);
        Assert.Null(links.Read(url.Split('/').Last()[..^2] + "AA"));
    }
}
