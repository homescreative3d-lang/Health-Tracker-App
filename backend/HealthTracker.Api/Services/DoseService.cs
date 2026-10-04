using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

public interface IDoseService
{
    Task<List<DoseResponse>> Get(Guid userId, DateOnly date, Guid? patientId);
    Task<DoseResponse> Take(Guid userId, Guid id);
    Task<DoseResponse> Skip(Guid userId, Guid id, string reason);
    Task<DoseResponse> Reschedule(Guid userId, Guid id, DateOnly date);
    Task<DoseResponse> Undo(Guid userId, Guid id);
}

public class DoseService(AppDbContext db) : IDoseService
{
    public async Task<List<DoseResponse>> Get(Guid userId, DateOnly date, Guid? patientId)
    {
        var accessibleUsers = await AccessibleUserIds(userId);
        Patient patient;
        if (patientId.HasValue)
        {
            patient = await db.Patients.SingleOrDefaultAsync(x => x.Id == patientId.Value)
                ?? throw new KeyNotFoundException("Patient not found.");
            if (!accessibleUsers.Contains(patient.UserId))
                throw new UnauthorizedAccessException("You do not have access to this patient.");
        }
        else
        {
            patient = await db.Patients.SingleOrDefaultAsync(x => x.UserId == userId)
                ?? throw new KeyNotFoundException("Patient not found.");
        }

        var medicines = await db.Medicines.Where(x => x.PatientId == patient.Id).ToListAsync();
        var result = new List<DoseResponse>();

        foreach (var medicine in medicines)
        {
            if (!Occurs(medicine, date))
                continue;

            var times = JsonSerializer.Deserialize<List<string>>(medicine.TimesJson) ?? [];
            foreach (var time in times.Distinct(StringComparer.Ordinal))
            {
                var dose = await db.DoseEvents.SingleOrDefaultAsync(x =>
                    x.PatientId == patient.Id &&
                    x.MedicineId == medicine.Id &&
                    x.Date == date &&
                    x.Time == time);

                if (dose is null)
                {
                    dose = new DoseEvent
                    {
                        PatientId = patient.Id,
                        MedicineId = medicine.Id,
                        Date = date,
                        Time = time
                    };
                    db.DoseEvents.Add(dose);
                    await db.SaveChangesAsync();
                }

                result.Add(Map(dose, medicine, patient));
            }
        }

        return result.OrderBy(x => x.Time).ToList();
    }

    public async Task<DoseResponse> Take(Guid userId, Guid id)
    {
        var pair = await GetAuthorizedEvent(userId, id);
        pair.Event.Status = "taken";
        pair.Event.TakenAt = DateTimeOffset.UtcNow;
        pair.Event.ActionedByUserId = userId;
        await db.SaveChangesAsync();
        return Map(pair.Event, pair.Medicine, pair.Patient);
    }

    public async Task<DoseResponse> Skip(Guid userId, Guid id, string reason)
    {
        var pair = await GetAuthorizedEvent(userId, id);
        pair.Event.Status = "skipped";
        pair.Event.SkipReason = reason;
        pair.Event.ActionedByUserId = userId;
        await db.SaveChangesAsync();
        return Map(pair.Event, pair.Medicine, pair.Patient);
    }

    public async Task<DoseResponse> Reschedule(Guid userId, Guid id, DateOnly date)
    {
        var pair = await GetAuthorizedEvent(userId, id);
        pair.Event.Status = "rescheduled";
        pair.Event.RescheduleTo = date;
        pair.Event.ActionedByUserId = userId;
        await db.SaveChangesAsync();
        return Map(pair.Event, pair.Medicine, pair.Patient);
    }

    public async Task<DoseResponse> Undo(Guid userId, Guid id)
    {
        var pair = await GetAuthorizedEvent(userId, id);
        pair.Event.Status = "pending";
        pair.Event.TakenAt = null;
        pair.Event.SkipReason = null;
        pair.Event.RescheduleTo = null;
        pair.Event.ActionedByUserId = userId;
        await db.SaveChangesAsync();
        return Map(pair.Event, pair.Medicine, pair.Patient);
    }

    private async Task<HashSet<Guid>> AccessibleUserIds(Guid userId)
    {
        var ids = await db.FamilyMembers
            .Where(x => x.UserId == userId && x.Status == "approved")
            .Join(db.FamilyMembers,
                member => member.FamilyId,
                familyMember => familyMember.FamilyId,
                (_, familyMember) => familyMember.UserId)
            .Distinct()
            .ToListAsync();

        ids.Add(userId);
        return ids.ToHashSet();
    }

    private async Task<(DoseEvent Event, Medicine Medicine, Patient Patient)> GetAuthorizedEvent(Guid userId, Guid id)
    {
        var dose = await db.DoseEvents.SingleOrDefaultAsync(x => x.Id == id)
            ?? throw new KeyNotFoundException("Dose not found.");

        var patient = await db.Patients.SingleOrDefaultAsync(x => x.Id == dose.PatientId)
            ?? throw new KeyNotFoundException("Patient not found.");

        var accessibleUsers = await AccessibleUserIds(userId);
        if (!accessibleUsers.Contains(patient.UserId))
            throw new UnauthorizedAccessException("You do not have access to this dose.");

        var medicine = await db.Medicines.SingleOrDefaultAsync(x =>
            x.Id == dose.MedicineId && x.PatientId == patient.Id)
            ?? throw new KeyNotFoundException("Medicine not found.");

        return (dose, medicine, patient);
    }

    private static DoseResponse Map(DoseEvent dose, Medicine medicine, Patient patient) =>
        new(
            dose.Id,
            medicine.Id,
            patient.Id.ToString(),
            patient.Name,
            medicine.Name,
            medicine.Strength,
            medicine.Form,
            medicine.Condition,
            dose.Time,
            medicine.Liquid,
            medicine.WithFood,
            dose.Status,
            dose.TakenAt,
            dose.SkipReason,
            dose.RescheduleTo?.ToString("yyyy-MM-dd"),
            dose.ActionedByUserId);

    private static bool Occurs(Medicine medicine, DateOnly date)
    {
        if (date < medicine.StartDate)
            return false;

        var diff = date.DayNumber - medicine.StartDate.DayNumber;

        if (!string.Equals(medicine.DurationType, "ongoing", StringComparison.OrdinalIgnoreCase))
        {
            var durationDays = medicine.DurationUnit switch
            {
                "weeks" => medicine.DurationValue * 7,
                "months" => medicine.DurationValue * 30,
                _ => medicine.DurationValue
            };

            if (diff >= durationDays)
                return false;
        }

        return medicine.FrequencyPattern switch
        {
            "daily" => true,
            "everyOtherDay" => diff % 2 == 0,
            "specificDays" => (JsonSerializer.Deserialize<List<string>>(medicine.SpecificDaysJson) ?? [])
                .Contains(date.DayOfWeek.ToString()[..3], StringComparer.OrdinalIgnoreCase),
            "recurringCycle" => medicine.CycleUnit switch
            {
                "weeks" => diff % Math.Max(1, medicine.CycleEvery * 7) == 0,
                "months" => date.Day == medicine.StartDate.Day,
                _ => diff % Math.Max(1, medicine.CycleEvery) == 0
            },
            _ => false
        };
    }
}