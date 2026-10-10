using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HealthTracker.Tests;
/// <summary>Business rules for taking, skipping and undoing doses.</summary>
public class DoseRuleTests
{
    /// <summary>Creates an in-memory database with one user, patient, medicine and dose.</summary>
    static (AppDbContext Db, DoseService Svc, Guid User, Guid DoseId) Setup(DateOnly date, string time, int supply = 5)
    {
        var o = new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        var db = new AppDbContext(o);
        var u = new AppUser
        {
            Email = "test@example.com",
            DisplayName = "Test",
            TimeZoneId = "Asia/Kolkata"
        };
        var p = new Patient
        {
            UserId = u.Id,
            Name = "Patient"
        };
        var m = new Medicine
        {
            PatientId = p.Id,
            Name = "Medicine",
            Strength = "10 mg",
            Condition = "Hypertension",
            TimesJson = $"[\"{time}\"]",
            StartDate = date,
            SupplyCount = supply
        };
        var d = new DoseEvent
        {
            PatientId = p.Id,
            MedicineId = m.Id,
            Date = date,
            Time = time
        };
        db.AddRange(u, p, m, d);
        db.SaveChanges();
        return (db, new DoseService(db, new PatientAccessService(db)), u.Id, d.Id);
    }

    [Fact]
    public async Task CannotTakeBeforeScheduled()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var future = now.TimeOfDay.Add(TimeSpan.FromMinutes(30));
        var time = TimeOnly.FromTimeSpan(future).ToString("HH:mm");
        var x = Setup(date, time);
        await Assert.ThrowsAsync<InvalidOperationException>(() => x.Svc.Take(x.User, x.DoseId));
    }

    [Fact]
    public async Task TakeWithinOneHourDecrementsSupply()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var time = TimeOnly.FromTimeSpan(now.TimeOfDay.Subtract(TimeSpan.FromMinutes(20))).ToString("HH:mm");
        var x = Setup(date, time);
        var d = await x.Svc.Take(x.User, x.DoseId);
        Assert.Equal("taken", d.Status);
        Assert.Equal(4, await x.Db.Medicines.Select(m => m.SupplyCount).SingleAsync());
    }

    [Fact]
    public async Task LocksAfterOneHour()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var time = TimeOnly.FromTimeSpan(now.TimeOfDay.Subtract(TimeSpan.FromMinutes(70))).ToString("HH:mm");
        var x = Setup(date, time);
        await Assert.ThrowsAsync<InvalidOperationException>(() => x.Svc.Take(x.User, x.DoseId));
    }

    [Fact]
    public async Task FamilyUserCanTake()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var time = TimeOnly.FromTimeSpan(now.TimeOfDay.Subtract(TimeSpan.FromMinutes(10))).ToString("HH:mm");
        var x = Setup(date, time);
        var familyUser = new AppUser
        {
            Email = "family@example.com",
            DisplayName = "Family"
        };
        var f = new Family
        {
            OwnerUserId = x.User
        };
        x.Db.AddRange(f, familyUser, new FamilyMember { FamilyId = f.Id, UserId = x.User }, new FamilyMember { FamilyId = f.Id, UserId = familyUser.Id });
        x.Db.SaveChanges();
        var d = await x.Svc.Take(familyUser.Id, x.DoseId);
        Assert.Equal("taken", d.Status);
    }

    [Fact]
    public async Task ActionedDoseRemainsVisibleAfterMedicineTimeChanges()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var x = Setup(date, "08:00");
        var dose = await x.Db.DoseEvents.SingleAsync();
        dose.Status = "skipped";
        dose.SkipReason = "Out of stock";
        var medicine = await x.Db.Medicines.SingleAsync();
        medicine.TimesJson = "[\"09:00\"]";
        await x.Db.SaveChangesAsync();
        var patientId = await x.Db.Patients.Select(p => p.Id).SingleAsync();
        var rows = await x.Svc.Get(x.User, date, patientId);
        Assert.Contains(rows, d => d.Id == x.DoseId && d.Status == "skipped" && d.Time == "08:00");
    }

    [Fact]
    public async Task NoSupplyCannotBeTaken()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var time = TimeOnly.FromTimeSpan(now.TimeOfDay.Subtract(TimeSpan.FromMinutes(10))).ToString("HH:mm");
        var x = Setup(date, time, 0);
        await Assert.ThrowsAsync<InvalidOperationException>(() => x.Svc.Take(x.User, x.DoseId));
    }

    [Fact]
    public async Task UndoAfterTakeRestoresSupply()
    {
        var now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Kolkata"));
        var date = DateOnly.FromDateTime(now.DateTime);
        var time = TimeOnly.FromTimeSpan(now.TimeOfDay.Subtract(TimeSpan.FromMinutes(10))).ToString("HH:mm");
        var x = Setup(date, time, supply: 5);
        await x.Svc.Take(x.User, x.DoseId);
        var undone = await x.Svc.Undo(x.User, x.DoseId);
        Assert.Equal("pending", undone.Status);
        Assert.Equal(5, await x.Db.Medicines.Select(m => m.SupplyCount).SingleAsync());
    }

    [Fact]
    public async Task GetWithoutPatientIdWorksForUsersWithSeveralPatients()
    {
        var x = Setup(DateOnly.FromDateTime(DateTime.UtcNow), "08:00");
        x.Db.Patients.Add(new Patient { UserId = x.User, Name = "Second patient" });
        await x.Db.SaveChangesAsync();
        // Previously SingleOrDefault threw for users owning more than one patient.
        var doses = await x.Svc.Get(x.User, DateOnly.FromDateTime(DateTime.UtcNow), null);
        Assert.NotNull(doses);
    }

    [Fact]
    public async Task RescheduleMovesDoseAndLinksIt()
    {
        var x = Setup(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), "08:00");
        var target = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2);
        var moved = await x.Svc.Reschedule(x.User, x.DoseId, target, "15:30");
        Assert.Equal("pending", moved.Status);
        Assert.Equal("15:30", moved.Time);
        Assert.Equal(x.DoseId, moved.RescheduledFromId);
        Assert.Equal("rescheduled", await x.Db.DoseEvents.Where(d => d.Id == x.DoseId).Select(d => d.Status).SingleAsync());
        // The moved dose appears on the target date even though 15:30 isn't on the regular schedule.
        var onTarget = await x.Svc.Get(x.User, target, null);
        Assert.Contains(onTarget, d => d.Id == moved.Id && d.RescheduledFromTime == "08:00");
    }

    [Fact]
    public async Task UndoRescheduleRemovesMovedDose()
    {
        var x = Setup(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), "08:00");
        var moved = await x.Svc.Reschedule(x.User, x.DoseId, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2), "09:00");
        var original = await x.Svc.Undo(x.User, x.DoseId);
        Assert.Equal("pending", original.Status);
        Assert.False(await x.Db.DoseEvents.AnyAsync(d => d.Id == moved.Id));
    }

    [Fact]
    public async Task CannotRescheduleIntoThePast()
    {
        var x = Setup(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1), "08:00");
        await Assert.ThrowsAsync<InvalidOperationException>(() => x.Svc.Reschedule(x.User, x.DoseId, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1), "08:00"));
    }
}
