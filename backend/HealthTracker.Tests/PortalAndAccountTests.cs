using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HealthTracker.Tests;

/// <summary>Phone normalization, patient-email linking and soft-delete rules.</summary>
public class PortalAndAccountTests
{
    /// <summary>Push sender that does nothing (linking notifies through it).</summary>
    private sealed class NoPush : IPushNotificationService
    {
        public Task<bool> SendToUsersAsync(IEnumerable<Guid> userIds, string title, string body, string type, Guid? doseId = null, CancellationToken ct = default, string? medicineForm = null) => Task.FromResult(false);
        public Task<PushTestResult> SendTestAsync(Guid userId, CancellationToken ct = default) => Task.FromResult(new PushTestResult(true, 0, 0, 0, null, null));
    }

    private static AppDbContext Db() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Theory]
    [InlineData("+91 98450 12345", "+919845012345")]
    [InlineData("0091-98450-12345", "+919845012345")]
    [InlineData("+1 (415) 555-0100", "+14155550100")]
    [InlineData("", "")]
    public void PhoneNumbersAreNormalizedToE164(string input, string expected) => Assert.Equal(expected, PhoneNumber.Normalize(input));

    [Fact]
    public void PhoneWithoutCountryCodeIsRejected() => Assert.Throws<ArgumentException>(() => PhoneNumber.Normalize("98450 12345"));

    [Fact]
    public async Task UserIsLinkedToPatientCarryingTheirEmail()
    {
        await using var db = Db();
        var caregiver = new AppUser { Email = "carer@example.com", DisplayName = "Carer" };
        var patientUser = new AppUser { Email = "kamala@example.com", DisplayName = "Kamala" };
        var patient = new Patient { UserId = caregiver.Id, Name = "Kamala", Email = "kamala@example.com" };
        db.AddRange(caregiver, patientUser, patient);
        await db.SaveChangesAsync();
        await new PatientLinker(db, new NoPush()).LinkByEmailAsync(patientUser);
        Assert.Equal(patientUser.Id, (await db.Patients.SingleAsync()).LinkedUserId);
        Assert.True(await db.Notifications.AnyAsync(n => n.UserId == patientUser.Id && n.Type == "patient_linked"));
    }

    [Fact]
    public async Task RemovingPatientEmailUnlinks()
    {
        await using var db = Db();
        var caregiver = new AppUser { Email = "carer@example.com", DisplayName = "Carer" };
        var patientUser = new AppUser { Email = "kamala@example.com", DisplayName = "Kamala" };
        var patient = new Patient { UserId = caregiver.Id, Name = "Kamala", Email = "", LinkedUserId = patientUser.Id };
        db.AddRange(caregiver, patientUser, patient);
        await db.SaveChangesAsync();
        await new PatientLinker(db, new NoPush()).SyncPatientAsync(patient, "kamala@example.com");
        Assert.Null(patient.LinkedUserId);
    }

    [Fact]
    public async Task LinkedPatientCanSeeOnlyTheirOwnRecord()
    {
        await using var db = Db();
        var caregiver = new AppUser { Email = "carer@example.com", DisplayName = "Carer" };
        var patientUser = new AppUser { Email = "kamala@example.com", DisplayName = "Kamala" };
        var mine = new Patient { UserId = caregiver.Id, Name = "Kamala", LinkedUserId = patientUser.Id };
        var other = new Patient { UserId = caregiver.Id, Name = "Someone else" };
        db.AddRange(caregiver, patientUser, mine, other);
        await db.SaveChangesAsync();
        var access = new PatientAccessService(db);
        Assert.True(await access.CanAccessPatientAsync(patientUser.Id, mine.Id));
        Assert.False(await access.CanAccessPatientAsync(patientUser.Id, other.Id));
    }
}
