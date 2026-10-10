namespace HealthTracker.Api.Contracts;
/// <summary>Registration payload.</summary>
public record RegisterRequest(string Email, string Password, string DisplayName);
/// <summary>Sign-in credentials.</summary>
public record LoginRequest(string Email, string Password);
/// <summary>Signed-in session: the user and a JWT bearer token (8 hours).</summary>
public record AuthResponse(UserResponse User, string Token);
/// <summary>Public user profile; <c>ProfileImageUrl</c> is a signed URL valid for one hour.</summary>
public record UserResponse(Guid Id, string Email, string DisplayName, string TimeZoneId = "Asia/Kolkata", string? ProfileImageUrl = null);
/// <summary>An attachment: send <c>DataUrl</c> to upload a new file, or <c>Key</c> to keep an existing one.</summary>
public record PatientAttachmentRequest(string Name, string MimeType, string? DataUrl = null, string? Key = null);
/// <summary>Patient create/update payload. Images are base64 data URLs (new), storage keys (keep) or empty (remove).</summary>
public record PatientRequest(string Name, string? Dob, List<string> Conditions, string Notes, string? Relationship, string Mobile = "", string Doctor = "", string MedicalHistory = "", string ProfileImageUrl = "", string DoctorPhotoUrl = "", List<PatientAttachmentRequest>? Attachments = null);
/// <summary>Medicine create/update payload. Dates are <c>YYYY-MM-DD</c>; times are <c>HH:mm</c>.</summary>
public record MedicineRequest(string Name, string Strength, string Form, string Condition, string FrequencyPattern, List<string> SpecificDays, int CycleEvery, string CycleUnit, List<string> Times, string Liquid, bool WithFood, string StartDate, string DurationType, int DurationValue, string DurationUnit, int SupplyCount, int RefillThreshold, bool IsRecurring = true);
/// <summary>A medicine with its schedule, supply and pause range.</summary>
public record MedicineResponse(Guid Id, string PatientId, string PatientName, string Name, string Strength, string Form, string Condition, string FrequencyPattern, List<string> SpecificDays, int CycleEvery, string CycleUnit, List<string> Times, string Liquid, bool WithFood, string StartDate, string DurationType, int DurationValue, string DurationUnit, int SupplyCount, int RefillThreshold, bool IsRecurring, string? PauseStartDate, string? PauseEndDate);
/// <summary>One dose for a day, with status and who actioned it.</summary>
public record DoseResponse(Guid Id, Guid MedicineId, string PatientId, string PatientName, string MedName, string Strength, string Form, string Condition, string Time, string Liquid, bool WithFood, string Status, DateTimeOffset? TakenAt, string? SkipReason, string? RescheduleTo, Guid? ActionedByUserId, string? ActionedByName);
/// <summary>Reason for skipping a dose.</summary>
public record ReasonRequest(string Reason);
/// <summary>Target date (<c>YYYY-MM-DD</c>) for a rescheduled dose.</summary>
public record RescheduleRequest(string Date);
/// <summary>Name for a new family.</summary>
public record FamilyCreateRequest(string Name);
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
public record PauseMedicineRequest(string StartDate, string? EndDate);
/// <summary>Email to send a reset link to.</summary>
public record ForgotPasswordRequest(string Email);
/// <summary>Display name and photo for the signed-in user.</summary>
public record ProfileUpdateRequest(string DisplayName, string? ProfileImageUrl);
/// <summary>Reset token from the email link and the new password.</summary>
public record ResetPasswordRequest(string Token, string NewPassword);
