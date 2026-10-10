namespace HealthTracker.Api.Models;
public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string TimeZoneId { get; set; } = "Asia/Kolkata";
    public int NotificationLeadMinutes { get; set; } = 15;
    public int NotificationRepeatMinutes { get; set; } = 5;
    public bool FinalNotificationEnabled { get; set; } = true;
    public string? ProfileImageUrl { get; set; }
}

public class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Name { get; set; } = "";
    public DateOnly? Dob { get; set; }
    public string ConditionsJson { get; set; } = "[]";
    public string Notes { get; set; } = "";
    public string? Relationship { get; set; }
    public string Mobile { get; set; } = "";
    public string Doctor { get; set; } = "";
    public string MedicalHistory { get; set; } = "";
    public string? ProfileImageUrl { get; set; }
    public string? DoctorPhotoUrl { get; set; }
    public string AttachmentsJson { get; set; } = "[]";
}

public class Medicine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public string Name { get; set; } = "";
    public string Strength { get; set; } = "";
    public string Form { get; set; } = "Pill";
    public string Condition { get; set; } = "";
    public string FrequencyPattern { get; set; } = "daily";
    public string SpecificDaysJson { get; set; } = "[]";
    public int CycleEvery { get; set; } = 1;
    public string CycleUnit { get; set; } = "days";
    public string TimesJson { get; set; } = "[\"08:00\"]";
    public string Liquid { get; set; } = "No liquid needed";
    public bool WithFood { get; set; }
    public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    public string DurationType { get; set; } = "ongoing";
    public int DurationValue { get; set; } = 30;
    public string DurationUnit { get; set; } = "days";
    public int SupplyCount { get; set; } = 30;
    public int RefillThreshold { get; set; } = 7;
    public bool IsRecurring { get; set; } = true;
    public DateOnly? PauseStartDate { get; set; }
    public DateOnly? PauseEndDate { get; set; }
}

public class DoseEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid MedicineId { get; set; }
    public DateOnly Date { get; set; }
    public string Time { get; set; } = "08:00";
    public string Status { get; set; } = "pending";
    public DateTimeOffset? TakenAt { get; set; }
    public string? SkipReason { get; set; }
    public DateOnly? RescheduleTo { get; set; }
    public Guid? ActionedByUserId { get; set; }
    public DateTimeOffset? MissedAt { get; set; }
}

public class Family
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "My Family";
    public Guid OwnerUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class FamilyMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FamilyId { get; set; }
    public Guid UserId { get; set; }
    public string Status { get; set; } = "approved";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class FamilyInvite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FamilyId { get; set; }
    public Guid InviterUserId { get; set; }
    public Guid InviteeUserId { get; set; }
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class AppNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Message { get; set; } = "";
    public string DataJson { get; set; } = "{}";
    public bool IsRead { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class PushSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public class NotificationDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? DoseEventId { get; set; }
    public string Type { get; set; } = "";
    public DateTimeOffset ScheduledFor { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    public string Status { get; set; } = "pending";
    public string? Error { get; set; }
}

public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Used { get; set; }
}
