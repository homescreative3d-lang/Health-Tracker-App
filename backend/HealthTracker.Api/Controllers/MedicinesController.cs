using System.Security.Claims;
using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/medicines")]
public class MedicinesController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] Guid? patientId)
    {
        var patient = await GetAuthorizedPatient(patientId);
        var medicines = await db.Medicines.Where(x => x.PatientId == patient.Id).ToListAsync();
        return Ok(medicines.Select(m => Map(m, patient)));
    }

    [HttpPost]
    public async Task<IActionResult> Post(MedicineRequest request, [FromQuery] Guid? patientId)
    {
        var patient = await GetAuthorizedPatient(patientId);
        var medicine = new Medicine { PatientId = patient.Id };
        Apply(medicine, request);
        db.Medicines.Add(medicine);
        await db.SaveChangesAsync();
        return Ok(Map(medicine, patient));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Put(Guid id, MedicineRequest request, [FromQuery] Guid? patientId)
    {
        var patient = await GetAuthorizedPatient(patientId);
        var medicine = await db.Medicines.SingleOrDefaultAsync(x => x.Id == id && x.PatientId == patient.Id);
        if (medicine is null)
            return NotFound();

        Apply(medicine, request);
        await db.SaveChangesAsync();
        return Ok(Map(medicine, patient));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, [FromQuery] Guid? patientId)
    {
        var patient = await GetAuthorizedPatient(patientId);
        var medicine = await db.Medicines.SingleOrDefaultAsync(x => x.Id == id && x.PatientId == patient.Id);
        if (medicine is null)
            return NotFound();

        db.Medicines.Remove(medicine);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<Patient> GetAuthorizedPatient(Guid? patientId)
    {
        if (!patientId.HasValue)
        {
            return await db.Patients.SingleOrDefaultAsync(x => x.UserId == UserId)
                ?? throw new KeyNotFoundException("Patient not found.");
        }

        var ids = await db.FamilyMembers
            .Where(x => x.UserId == UserId && x.Status == "approved")
            .Join(db.FamilyMembers,
                member => member.FamilyId,
                familyMember => familyMember.FamilyId,
                (_, familyMember) => familyMember.UserId)
            .Distinct()
            .ToListAsync();

        ids.Add(UserId);

        return await db.Patients.SingleOrDefaultAsync(x => x.Id == patientId.Value && ids.Contains(x.UserId))
            ?? throw new UnauthorizedAccessException("You do not have access to this patient.");
    }

    private static MedicineResponse Map(Medicine medicine, Patient patient) =>
        new(
            medicine.Id,
            patient.Id.ToString(),
            patient.Name,
            medicine.Name,
            medicine.Strength,
            medicine.Form,
            medicine.Condition,
            medicine.FrequencyPattern,
            JsonSerializer.Deserialize<List<string>>(medicine.SpecificDaysJson) ?? [],
            medicine.CycleEvery,
            medicine.CycleUnit,
            JsonSerializer.Deserialize<List<string>>(medicine.TimesJson) ?? [],
            medicine.Liquid,
            medicine.WithFood,
            medicine.StartDate.ToString("yyyy-MM-dd"),
            medicine.DurationType,
            medicine.DurationValue,
            medicine.DurationUnit,
            medicine.SupplyCount,
            medicine.RefillThreshold);

    private static void Apply(Medicine medicine, MedicineRequest request)
    {
        medicine.Name = request.Name.Trim();
        medicine.Strength = request.Strength.Trim();
        medicine.Form = request.Form;
        medicine.Condition = request.Condition.Trim();
        medicine.FrequencyPattern = request.FrequencyPattern;
        medicine.SpecificDaysJson = JsonSerializer.Serialize(request.SpecificDays ?? []);
        medicine.CycleEvery = Math.Max(1, request.CycleEvery);
        medicine.CycleUnit = request.CycleUnit;
        medicine.TimesJson = JsonSerializer.Serialize(request.Times?.Distinct() ?? []);
        medicine.Liquid = request.Liquid;
        medicine.WithFood = request.WithFood;
        medicine.StartDate = DateOnly.Parse(request.StartDate);
        medicine.DurationType = request.DurationType;
        medicine.DurationValue = Math.Max(1, request.DurationValue);
        medicine.DurationUnit = request.DurationUnit;
        medicine.SupplyCount = Math.Max(0, request.SupplyCount);
        medicine.RefillThreshold = Math.Max(0, request.RefillThreshold);
    }
}