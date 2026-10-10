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
/// Patient profiles: personal details, conditions, photos and attachments.
/// </summary>
/// <remarks>
/// Images and attachments are sent as base64 data URLs and stored in object storage; responses
/// contain pre-signed URLs valid for one hour. Approved family members can view and edit.
/// </remarks>
[Authorize]
[Route("api/patient")]
public class PatientController(AppDbContext db, INeonObjectStorage storage, IPatientAccessService access) : ApiControllerBase
{
    Guid U => CurrentUserId;

    /// <summary>
    /// Returns the user's own first patient, or an empty placeholder when none exists.
    /// </summary>
    /// <remarks>Legacy single-patient endpoint; prefer <c>GET /api/patient/all</c>.</remarks>
    /// <response code="200">The patient (empty id when none).</response>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var p = await db.Patients.FirstOrDefaultAsync(x => x.UserId == U);
        if (p is null)
            return Ok(new { id = Guid.Empty, name = "", dob = (DateOnly?)null, conditions = Array.Empty<string>(), notes = "", relationship = (string?)null, mobile = "", doctor = "", medicalHistory = "", doctorPhotoUrl = (string?)null, profileImageUrl = (string?)null, attachments = Array.Empty<object>() });
        return Ok(await Map(p));
    }

    /// <summary>
    /// Lists every patient the user can access (own and shared through family), with owner details.
    /// </summary>
    /// <response code="200">Patients.</response>
    [HttpGet("all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> All()
    {
        var ids = await access.GetAccessibleOwnerIdsAsync(U);
        var rows = await db.Patients.Where(x => ids.Contains(x.UserId)).Join(db.Users, p => p.UserId, u => u.Id, (p, u) => new { p, u }).ToListAsync();
        var result = rows.Select(x => new { x.p.Id, x.p.UserId, x.p.Name, x.p.Dob, Conditions = JsonSerializer.Deserialize<List<string>>(x.p.ConditionsJson) ?? [], x.p.Notes, x.p.Relationship, x.p.Mobile, x.p.Doctor, x.p.MedicalHistory, DoctorPhotoUrl = string.IsNullOrWhiteSpace(x.p.DoctorPhotoUrl) ? null : storage.GetReadUrl("patient", x.p.DoctorPhotoUrl), ProfileImageUrl = string.IsNullOrWhiteSpace(x.p.ProfileImageUrl) ? null : storage.GetReadUrl("patient", x.p.ProfileImageUrl), Attachments = MapAttachments(x.p), OwnerName = x.u.DisplayName, OwnerEmail = x.u.Email }).ToList();
        return Ok(result);
    }

    /// <summary>
    /// Creates a patient owned by the signed-in user.
    /// </summary>
    /// <param name="r">Patient details; <c>Dob</c> is <c>YYYY-MM-DD</c> or empty.</param>
    /// <response code="200">The created patient.</response>
    /// <response code="400">Invalid date, image or attachment.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(PatientRequest r)
    {
        var p = Build(r, U);
        if (IsDataImage(r.ProfileImageUrl))
            p.ProfileImageUrl = await storage.PutDataUrlAsync("patient", $"{p.Id}/{Guid.NewGuid():N}", r.ProfileImageUrl);
        if (IsDataImage(r.DoctorPhotoUrl))
            p.DoctorPhotoUrl = await storage.PutDataUrlAsync("patient", $"{p.Id}/doctor-{Guid.NewGuid():N}", r.DoctorPhotoUrl);
        await UpdateAttachments(p, r.Attachments);
        db.Patients.Add(p);
        await db.SaveChangesAsync();
        return Ok(await Map(p));
    }

    /// <summary>
    /// Updates the user's own first patient (legacy; prefer <c>PUT /api/patient/{id}</c>).
    /// </summary>
    /// <param name="r">Patient details.</param>
    /// <response code="200">The updated patient.</response>
    /// <response code="404">The user has no patient.</response>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Put(PatientRequest r) => UpdateOwned(null, r);
    /// <summary>
    /// Updates a patient the user can access. Omitted attachments are deleted from storage.
    /// </summary>
    /// <param name="id">Patient id.</param>
    /// <param name="r">Patient details.</param>
    /// <response code="200">The updated patient.</response>
    /// <response code="400">Invalid date, image or attachment.</response>
    /// <response code="404">Patient not found or not accessible.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Put(Guid id, PatientRequest r) => UpdateOwned(id, r);
    /// <summary>
    /// Shared update logic for both PUT routes.
    /// </summary>
    /// <param name="id">Patient id, or null for the user's own first patient.</param>
    /// <param name="r">Patient details.</param>
    async Task<IActionResult> UpdateOwned(Guid? id, PatientRequest r)
    {
        var accessible = await access.GetAccessibleOwnerIdsAsync(U);
        // Without an id, use the user's OWN first patient. Previously this was SingleOrDefault over
        // every accessible patient, which threw (500) for anyone with more than one patient.
        var p = id is null
            ? await db.Patients.FirstOrDefaultAsync(x => x.UserId == U)
            : await db.Patients.SingleOrDefaultAsync(x => x.Id == id.Value && accessible.Contains(x.UserId));
        if (p is null)
            return NotFound();
        var old = p.ProfileImageUrl;
        p.Name = r.Name.Trim();
        p.Dob = ParseDob(r.Dob);
        p.ConditionsJson = JsonSerializer.Serialize(r.Conditions ?? []);
        p.Notes = r.Notes;
        p.Relationship = r.Relationship;
        p.Mobile = r.Mobile?.Trim() ?? "";
        p.Doctor = r.Doctor?.Trim() ?? "";
        p.MedicalHistory = r.MedicalHistory?.Trim() ?? "";
        var oldDoctorPhoto = p.DoctorPhotoUrl;
        if (IsDataImage(r.DoctorPhotoUrl))
            p.DoctorPhotoUrl = await storage.PutDataUrlAsync("patient", $"{p.Id}/doctor-{Guid.NewGuid():N}", r.DoctorPhotoUrl);
        else if (string.IsNullOrWhiteSpace(r.DoctorPhotoUrl))
            p.DoctorPhotoUrl = null;
        else if (!r.DoctorPhotoUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            p.DoctorPhotoUrl = r.DoctorPhotoUrl.Trim();
        if (p.DoctorPhotoUrl != oldDoctorPhoto && !string.IsNullOrWhiteSpace(oldDoctorPhoto))
            await storage.DeleteAsync("patient", oldDoctorPhoto);
        if (IsDataImage(r.ProfileImageUrl))
            p.ProfileImageUrl = await storage.PutDataUrlAsync("patient", $"{p.Id}/{Guid.NewGuid():N}", r.ProfileImageUrl);
        else if (string.IsNullOrWhiteSpace(r.ProfileImageUrl))
            p.ProfileImageUrl = null;
        else if (!r.ProfileImageUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            p.ProfileImageUrl = r.ProfileImageUrl.Trim();
        if (p.ProfileImageUrl != old && !string.IsNullOrWhiteSpace(old))
            await storage.DeleteAsync("patient", old);
        await UpdateAttachments(p, r.Attachments);
        await db.SaveChangesAsync();
        return Ok(await Map(p));
    }

    /// <summary>
    /// Parses an optional date of birth.
    /// </summary>
    /// <param name="value">Date in <c>YYYY-MM-DD</c>, or empty.</param>
    /// <exception cref="ArgumentException">Invalid format (mapped to 400; previously 500).</exception>
    static DateOnly? ParseDob(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null
        : DateOnly.TryParse(value, out var dob) ? dob
        : throw new ArgumentException("Enter a valid date of birth (YYYY-MM-DD).");

    /// <summary>True when the value is a base64 image data URL (a new upload).</summary>
    static bool IsDataImage(string? value) => !string.IsNullOrWhiteSpace(value) && value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase);
    /// <summary>Creates a new patient entity from a request (images are uploaded afterwards).</summary>
    static Patient Build(PatientRequest r, Guid uid) => new()
    {
        UserId = uid,
        Name = r.Name.Trim(),
        Dob = ParseDob(r.Dob),
        ConditionsJson = JsonSerializer.Serialize(r.Conditions ?? []),
        Notes = r.Notes,
        Relationship = r.Relationship,
        Mobile = r.Mobile?.Trim() ?? "",
        Doctor = r.Doctor?.Trim() ?? "",
        MedicalHistory = r.MedicalHistory?.Trim() ?? "",
        ProfileImageUrl = null,
        DoctorPhotoUrl = null,
        AttachmentsJson = "[]"
    };
    /// <summary>Attachment metadata persisted in <c>Patient.AttachmentsJson</c>.</summary>
    sealed record StoredAttachment(string Name, string MimeType, string Key, long Size);
    /// <summary>Returns attachments with pre-signed download URLs.</summary>
    List<object> MapAttachments(Patient p) => (JsonSerializer.Deserialize<List<StoredAttachment>>(p.AttachmentsJson ?? "[]") ?? []).Select(a => (object)new { a.Name, a.MimeType, a.Key, a.Size, Url = storage.GetReadUrl("patient", a.Key) }).ToList();
    /// <summary>
    /// Uploads new attachments, keeps referenced existing ones, and deletes removed ones from storage.
    /// </summary>
    /// <param name="p">Patient being saved.</param>
    /// <param name="requested">Desired attachment list; null leaves attachments unchanged.</param>
    async Task UpdateAttachments(Patient p, List<PatientAttachmentRequest>? requested)
    {
        if (requested is null)
            return;
        var old = JsonSerializer.Deserialize<List<StoredAttachment>>(p.AttachmentsJson ?? "[]") ?? [];
        var next = new List<StoredAttachment>();
        foreach (var item in requested)
        {
            if (!string.IsNullOrWhiteSpace(item.DataUrl))
            {
                var name = Path.GetFileName(item.Name);
                if (string.IsNullOrWhiteSpace(name))
                    throw new ArgumentException("Attachment filename is required.");
                var key = $"{p.Id}/attachments/{Guid.NewGuid():N}";
                var stored = await storage.PutFileDataUrlAsync("patient", key, item.MimeType, item.DataUrl);
                next.Add(new StoredAttachment(name, stored.MimeType, stored.Key, stored.Size));
            }
            else if (!string.IsNullOrWhiteSpace(item.Key) && item.Key.StartsWith($"{p.Id}/attachments/", StringComparison.Ordinal))
            {
                var existing = old.FirstOrDefault(a => a.Key == item.Key);
                if (existing is not null)
                    next.Add(existing);
            }
        }

        var keep = next.Select(a => a.Key).ToHashSet(StringComparer.Ordinal);
        foreach (var removed in old.Where(a => !keep.Contains(a.Key)))
            await storage.DeleteAsync("patient", removed.Key);
        p.AttachmentsJson = JsonSerializer.Serialize(next);
    }

    /// <summary>Maps a patient to its API response with signed media URLs.</summary>
    Task<object> Map(Patient p) => Task.FromResult<object>(new
    {
        p.Id,
        p.Name,
        p.Dob,
        Conditions = JsonSerializer.Deserialize<List<string>>(p.ConditionsJson) ?? [],
        p.Notes,
        p.Relationship,
        p.Mobile,
        p.Doctor,
        p.MedicalHistory,
        DoctorPhotoUrl = string.IsNullOrWhiteSpace(p.DoctorPhotoUrl) ? null : storage.GetReadUrl("patient", p.DoctorPhotoUrl),
        ProfileImageUrl = string.IsNullOrWhiteSpace(p.ProfileImageUrl) ? null : storage.GetReadUrl("patient", p.ProfileImageUrl),
        Attachments = MapAttachments(p)
    });
}
