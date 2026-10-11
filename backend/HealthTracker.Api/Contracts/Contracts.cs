namespace HealthTracker.Api.Contracts;
/// <summary>Registration payload.</summary>
public record RegisterRequest(string Email, string Password, string DisplayName, string? Phone = null);
/// <summary>Sign-in credentials.</summary>
public record LoginRequest(string Email, string Password);
/// <summary>Signed-in session: the user and a JWT bearer token (8 hours).</summary>
public record AuthResponse(UserResponse User, string Token);
/// <summary>Public user profile; <c>ProfileImageUrl</c> is a signed URL valid for one hour.</summary>
public record UserResponse(Guid Id, string Email, string DisplayName, string TimeZoneId = "Asia/Kolkata", string? ProfileImageUrl = null, string Phone = "", bool IsLinkedPatient = false, List<Guid>? LinkedPatientIds = null, bool CanMarkOwnDoses = false);
/// <summary>An attachment: send <c>DataUrl</c> to upload a new file, or <c>Key</c> to keep an existing one.</summary>
public record PatientAttachmentRequest(string Name, string MimeType, string? DataUrl = null, string? Key = null);
/// <summary>Patient create/update payload. Images are base64 data URLs (new), storage keys (keep) or empty (remove).</summary>
public record PatientRequest(string Name, string? Dob, List<string> Conditions, string Notes, string? Relationship, string Mobile = "", string Doctor = "", string MedicalHistory = "", string ProfileImageUrl = "", string DoctorPhotoUrl = "", List<PatientAttachmentRequest>? Attachments = null, string? Email = null);
/// <summary>Medicine create/update payload. Dates are <c>YYYY-MM-DD</c>; times are <c>HH:mm</c>.</summary>
public record MedicineRequest(string Name, string Strength, string Form, string Condition, string FrequencyPattern, List<string> SpecificDays, int CycleEvery, string CycleUnit, List<string> Times, string Liquid, bool WithFood, string StartDate, string DurationType, int DurationValue, string DurationUnit, int SupplyCount, int RefillThreshold, bool IsRecurring = true, string? DoseAmount = null);
/// <summary>A medicine with its schedule, supply and pause range.</summary>
public record MedicineResponse(Guid Id, string PatientId, string PatientName, string Name, string Strength, string Form, string Condition, string FrequencyPattern, List<string> SpecificDays, int CycleEvery, string CycleUnit, List<string> Times, string Liquid, bool WithFood, string StartDate, string DurationType, int DurationValue, string DurationUnit, int SupplyCount, int RefillThreshold, bool IsRecurring, string? PauseStartDate, string? PauseEndDate, string? EndedOn = null, Guid? RescheduledFromId = null, List<string>? PreviousTimes = null, string DoseAmount = "");
/// <summary>One dose for a day, with status and who actioned it.</summary>
public record DoseResponse(Guid Id, Guid MedicineId, string PatientId, string PatientName, string MedName, string Strength, string Form, string Condition, string Time, string Liquid, bool WithFood, string Status, DateTimeOffset? TakenAt, string? SkipReason, string? RescheduleTo, Guid? ActionedByUserId, string? ActionedByName, string? RescheduleToTime = null, Guid? RescheduledFromId = null, string? RescheduledFromDate = null, string? RescheduledFromTime = null, string? Date = null, List<AuditEntryResponse>? History = null, string DoseAmount = "");
/// <summary>Reason for skipping a dose.</summary>
public record ReasonRequest(string Reason);
/// <summary>Where to move one dose: date (<c>YYYY-MM-DD</c>) and time (<c>HH:mm</c>, defaults to the original time).</summary>
public record RescheduleRequest(string Date, string? Time = null, string? Reason = null);

/// <summary>New dose times for a medicine, effective from a date (<c>YYYY-MM-DD</c>) onwards.</summary>
public record RescheduleMedicineRequest(string EffectiveDate, List<string> Times, string? Reason = null);
/// <summary>Name for a new family.</summary>
public record FamilyCreateRequest(string Name);
/// <summary>New family name and picture (data URL to upload, existing value to keep, empty to remove).</summary>
public record FamilyUpdateRequest(string Name, string? PhotoUrl);

/// <summary>Whether a member may add/remove members and edit the family.</summary>
public record FamilyPermissionRequest(bool CanManageMembers);

/// <summary>User to invite to the family.</summary>
public record FamilyInviteRequest(Guid UserId);
/// <summary>Answer to a family invitation.</summary>
public record FamilyInviteResponse(bool Accept);
/// <summary>Web Push subscription keys from the browser.</summary>
public record PushSubscriptionRequest(string Endpoint, string P256dh, string Auth);
/// <summary>Reminder timing settings.</summary>
public record NotificationSettingsRequest(string TimeZoneId, int LeadMinutes, int RepeatMinutes, bool FinalNotificationEnabled);
/// <summary>A dose history row.</summary>
public record HistoryResponse(Guid Id, string PatientId, string PatientName, string MedicineId, string MedicineName, string Time, string Date, string Status, DateTimeOffset? TakenAt, string? SkipReason, Guid? ActionedByUserId, string? ActionedByName);
/// <summary>Pause range; omit <c>EndDate</c> to pause until resumed.</summary>
public record PauseMedicineRequest(string StartDate, string? EndDate, string? Reason = null);
/// <summary>Email to send a reset link to.</summary>
public record ForgotPasswordRequest(string Email);
/// <summary>Display name and photo for the signed-in user.</summary>
public record ProfileUpdateRequest(string DisplayName, string? ProfileImageUrl, string? Phone = null);
/// <summary>Reset token from the email link and the new password.</summary>
public record ResetPasswordRequest(string Token, string NewPassword);

/// <summary>A prescribed item on a medical record.</summary>
public record MedicalRecordMedicine(string Name, string? Strength, string? Dose, string? Frequency, string? Duration, string? Instructions);

/// <summary>Create/update payload for a medical history entry.</summary>
/// <param name="Date">YYYY-MM-DD or empty when unknown.</param>
/// <param name="Type">diagnosis, prescription, procedure, allergy, lab, vaccination or note.</param>
/// <param name="Title">Short title shown on the timeline.</param>
/// <param name="Details">Free-text details.</param>
/// <param name="Doctor">Doctor / prescriber.</param>
/// <param name="Facility">Clinic or hospital.</param>
/// <param name="Medicines">Prescribed items (prescriptions).</param>
/// <param name="SourceDataUrl">Optional new source image/PDF as a data URL (replaces the current one).</param>
/// <param name="RemoveSource">True to remove the current source file.</param>
/// <param name="AiExtracted">True when the content came from a reviewed AI scan.</param>
public record MedicalRecordRequest(string? Date, string Type, string Title, string? Details, string? Doctor, string? Facility, List<MedicalRecordMedicine>? Medicines, string? SourceDataUrl, bool RemoveSource = false, bool AiExtracted = false);

/// <summary>A prescription or medical document to scan (image or PDF data URL, max 10 MB).</summary>
public record ExtractRequest(string DataUrl);

/// <summary>An audit trail entry as shown to users.</summary>
public record AuditEntryResponse(Guid Id, string EntityType, Guid EntityId, Guid? MedicineId, Guid? PatientId, string Action, string ActorName, string Reason, string Summary, DateTimeOffset At);

/// <summary>Patient portal settings set by the caregiver/admin.</summary>
public record PatientPortalRequest(bool CanMarkOwnDoses);

/// <summary>Turns a feature on/off globally, or for one user (null removes the override).</summary>
public record FeatureToggleRequest(bool? Enabled);
