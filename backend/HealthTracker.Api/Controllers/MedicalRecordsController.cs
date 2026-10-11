using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;

/// <summary>
/// A patient's medical history as dated records shown on a timeline, with optional prescription
/// scanning (Gemini) that returns an editable draft — nothing is saved until a person confirms.
/// </summary>
[Authorize]
[Route("api")]
public class MedicalRecordsController(
    AppDbContext db,
    IPatientAccessService access,
    INeonObjectStorage storage,
    IPrescriptionExtractor extractor,
    ICareTeamNotifier notifier,
    IConfiguration config) : ApiControllerBase
{
    private static readonly string[] Types = ["diagnosis", "prescription", "procedure", "allergy", "lab", "vaccination", "note"];
    private static readonly string[] ScanTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    private const long MaxScanBytes = 10 * 1024 * 1024;

    /// <summary>
    /// Whether prescription scanning is available, and whether to show the data-sharing notice
    /// (on by default; set <c>Gemini:ShowDataNotice=false</c> when using a paid key).
    /// </summary>
    /// <response code="200"><c>{ enabled, showDataNotice, provider }</c></response>
    [HttpGet("medical-records/ai-status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult AiStatus() =>
        Ok(new { enabled = extractor.IsEnabled, showDataNotice = config.GetValue("Gemini:ShowDataNotice", true), provider = "Google Gemini" });

    /// <summary>
    /// Lists a patient's medical records, newest first (undated entries last).
    /// </summary>
    /// <param name="patientId">Patient.</param>
    /// <response code="200">Records with a signed URL for any source document.</response>
    /// <response code="403">No access to the patient.</response>
    /// <response code="404">Patient not found.</response>
    [HttpGet("patients/{patientId:guid}/medical-records")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid patientId)
    {
        await access.GetAccessiblePatientAsync(CurrentUserId, patientId);
        var rows = await db.MedicalRecords.Where(r => r.PatientId == patientId).ToListAsync();
        return Ok(rows
            .OrderBy(r => r.Date is null)
            .ThenByDescending(r => r.Date)
            .ThenByDescending(r => r.CreatedAt)
            .Select(Map));
    }

    /// <summary>
    /// Scans a prescription image/PDF and returns an editable draft. Nothing is stored.
    /// </summary>
    /// <param name="patientId">Patient the document belongs to (access is checked).</param>
    /// <param name="r">The file as a data URL.</param>
    /// <response code="200">The draft: date, doctor, facility, diagnosis, notes, medicines, confidence.</response>
    /// <response code="400">Unsupported/too large file, unreadable image, quota reached or scanning not configured.</response>
    [HttpPost("patients/{patientId:guid}/medical-records/extract")]
    [ProducesResponseType<PrescriptionDraft>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Extract(Guid patientId, ExtractRequest r)
    {
        await access.GetAccessiblePatientAsync(CurrentUserId, patientId);
        var (mime, base64) = SplitDataUrl(r.DataUrl);
        if (!ScanTypes.Contains(mime))
            return BadRequestMessage("Use a photo (JPEG, PNG, WebP, HEIC) or a PDF of the prescription.");
        if (base64.Length * 3L / 4 > MaxScanBytes)
            return BadRequestMessage("The file must be 10 MB or smaller.");
        try
        {
            return Ok(await extractor.ExtractAsync(mime, base64, HttpContext.RequestAborted));
        }
        catch (InvalidOperationException e)
        {
            return BadRequestMessage(e.Message);
        }
    }

    /// <summary>
    /// Adds a medical history entry (optionally with its source document). The care team is notified.
    /// </summary>
    /// <param name="patientId">Patient.</param>
    /// <param name="r">Entry details.</param>
    /// <response code="200">The saved record.</response>
    /// <response code="400">Validation failed.</response>
    [HttpPost("patients/{patientId:guid}/medical-records")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(Guid patientId, MedicalRecordRequest r)
    {
        var patient = await access.GetAccessiblePatientAsync(CurrentUserId, patientId);
        var record = new MedicalRecord { PatientId = patientId, CreatedByUserId = CurrentUserId };
        var error = await Apply(record, r);
        if (error is not null)
            return BadRequestMessage(error);
        db.MedicalRecords.Add(record);
        await db.SaveChangesAsync();
        var who = (await db.Users.FindAsync(CurrentUserId))?.DisplayName ?? "Someone";
        await notifier.NotifyAsync(patient, "medical_record_added", "Medical history updated",
            $"{who} added “{record.Title}” to {patient.Name}'s medical history.",
            new { patientId, patientName = patient.Name, recordId = record.Id });
        return Ok(Map(record));
    }

    /// <summary>
    /// Updates a medical history entry.
    /// </summary>
    /// <param name="patientId">Patient.</param>
    /// <param name="id">Record id.</param>
    /// <param name="r">Entry details.</param>
    /// <response code="200">The updated record.</response>
    /// <response code="400">Validation failed.</response>
    /// <response code="404">Record not found.</response>
    [HttpPut("patients/{patientId:guid}/medical-records/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid patientId, Guid id, MedicalRecordRequest r)
    {
        await access.GetAccessiblePatientAsync(CurrentUserId, patientId);
        var record = await db.MedicalRecords.FirstOrDefaultAsync(x => x.Id == id && x.PatientId == patientId);
        if (record is null)
            return NotFound(new { message = "Record not found." });
        var error = await Apply(record, r);
        if (error is not null)
            return BadRequestMessage(error);
        record.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return Ok(Map(record));
    }

    /// <summary>
    /// Deletes a medical history entry and its source document.
    /// </summary>
    /// <param name="patientId">Patient.</param>
    /// <param name="id">Record id.</param>
    /// <response code="204">Deleted.</response>
    /// <response code="404">Record not found.</response>
    [HttpDelete("patients/{patientId:guid}/medical-records/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid patientId, Guid id)
    {
        await access.GetAccessiblePatientAsync(CurrentUserId, patientId);
        var record = await db.MedicalRecords.FirstOrDefaultAsync(x => x.Id == id && x.PatientId == patientId);
        if (record is null)
            return NotFound(new { message = "Record not found." });
        if (!string.IsNullOrWhiteSpace(record.SourceKey))
            await storage.DeleteAsync("patient", record.SourceKey);
        db.MedicalRecords.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Validates a request and copies it onto the entity (uploading a new source if given).</summary>
    /// <returns>A user-facing error, or null when valid.</returns>
    private async Task<string?> Apply(MedicalRecord record, MedicalRecordRequest r)
    {
        var type = (r.Type ?? "").Trim().ToLowerInvariant();
        if (!Types.Contains(type))
            return "Choose a record type.";
        var title = (r.Title ?? "").Trim();
        if (title.Length is < 2 or > 140)
            return "Enter a title (2–140 characters).";
        DateOnly? date = null;
        if (!string.IsNullOrWhiteSpace(r.Date))
        {
            if (!DateOnly.TryParse(r.Date, out var d))
                return "Enter a valid date (YYYY-MM-DD).";
            if (d > DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
                return "The date can't be in the future.";
            date = d;
        }

        var medicines = (r.Medicines ?? []).Where(m => !string.IsNullOrWhiteSpace(m.Name)).Take(50).ToList();
        record.Date = date;
        record.Type = type;
        record.Title = title;
        record.Details = (r.Details ?? "").Trim()[..Math.Min((r.Details ?? "").Trim().Length, 4000)];
        record.Doctor = (r.Doctor ?? "").Trim();
        record.Facility = (r.Facility ?? "").Trim();
        record.MedicinesJson = JsonSerializer.Serialize(medicines);
        record.AiExtracted = r.AiExtracted;

        if (!string.IsNullOrWhiteSpace(r.SourceDataUrl))
        {
            var (mime, _) = SplitDataUrl(r.SourceDataUrl);
            if (!ScanTypes.Contains(mime))
                return "The attached document must be an image or PDF.";
            var old = record.SourceKey;
            var stored = await storage.PutFileDataUrlAsync("patient", $"records/{record.PatientId}/{Guid.NewGuid():N}", mime, r.SourceDataUrl);
            record.SourceKey = stored.Key;
            record.SourceMimeType = stored.MimeType;
            if (!string.IsNullOrWhiteSpace(old))
                await storage.DeleteAsync("patient", old);
        }
        else if (r.RemoveSource && !string.IsNullOrWhiteSpace(record.SourceKey))
        {
            await storage.DeleteAsync("patient", record.SourceKey);
            record.SourceKey = null;
            record.SourceMimeType = null;
        }

        return null;
    }

    /// <summary>Splits <c>data:mime;base64,xxx</c> into MIME type and payload.</summary>
    private static (string Mime, string Base64) SplitDataUrl(string? dataUrl)
    {
        if (string.IsNullOrWhiteSpace(dataUrl) || !dataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return ("", "");
        var comma = dataUrl.IndexOf(',');
        if (comma < 0)
            return ("", "");
        var header = dataUrl[5..comma];
        var mime = header.Split(';')[0].Trim().ToLowerInvariant();
        return (mime, dataUrl[(comma + 1)..]);
    }

    /// <summary>Maps a record to its API shape with a signed source URL.</summary>
    private object Map(MedicalRecord r) => new
    {
        r.Id,
        r.PatientId,
        Date = r.Date?.ToString("yyyy-MM-dd"),
        r.Type,
        r.Title,
        r.Details,
        r.Doctor,
        r.Facility,
        Medicines = JsonSerializer.Deserialize<List<MedicalRecordMedicine>>(r.MedicinesJson) ?? [],
        SourceUrl = string.IsNullOrWhiteSpace(r.SourceKey) ? null : storage.GetReadUrl("patient", r.SourceKey),
        r.SourceMimeType,
        r.AiExtracted,
        r.CreatedAt,
        r.UpdatedAt
    };
}
