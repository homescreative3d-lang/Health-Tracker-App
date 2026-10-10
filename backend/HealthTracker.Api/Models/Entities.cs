namespace HealthTracker.Api.Models;
/// <summary>A registered account (caregiver or self-managing patient), with reminder preferences.</summary>
public class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    /// <summary>IANA time zone used for schedules and reminders.</summary>
    public string TimeZoneId { get; set; } = "Asia/Kolkata";
    /// <summary>Minutes before a dose that the first reminder is sent (0 disables).</summary>
    public int NotificationLeadMinutes { get; set; } = 15;
    /// <summary>Interval between repeated reminders before the dose time.</summary>
    public int NotificationRepeatMinutes { get; set; } = 5;
    public bool FinalNotificationEnabled { get; set; } = true;
    /// <summary>Object-storage key of the photo (not a URL; signed URLs are generated per response).</summary>
    public string? ProfileImageUrl { get; set; }
}

/// <summary>A person whose medicines are tracked. Owned by one user; shared with that user's approved family members.</summary>
public class Patient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Name { get; set; } = "";
    public DateOnly? Dob { get; set; }
    /// <summary>JSON array of condition names.</summary>
    public string ConditionsJson { get; set; } = "[]";
    public string Notes { get; set; } = "";
    public string? Relationship { get; set; }
    public string Mobile { get; set; } = "";
    public string Doctor { get; set; } = "";
    public string MedicalHistory { get; set; } = "";
    /// <summary>Object-storage key of the photo (not a URL; signed URLs are generated per response).</summary>
    public string? ProfileImageUrl { get; set; }
    public string? DoctorPhotoUrl { get; set; }
    /// <summary>JSON array of stored attachment metadata (name, MIME type, key, size).</summary>
    public string AttachmentsJson { get; set; } = "[]";
}

/// <summary>A medicine schedule definition; daily <see cref="DoseEvent"/> rows are generated from it.</summary>
public class Medicine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public string Name { get; set; } = "";
    public string Strength { get; set; } = "";
    public string Form { get; set; } = "Pill";
    public string Condition { get; set; } = "";
    /// <summary><c>daily</c>, <c>everyOtherDay</c>, <c>specificDays</c> or <c>recurringCycle</c>.</summary>
    public string FrequencyPattern { get; set; } = "daily";
    /// <summary>JSON array of weekday codes (<c>Mon</c>..<c>Sun</c>) for <c>specificDays</c>.</summary>
    public string SpecificDaysJson { get; set; } = "[]";
    public int CycleEvery { get; set; } = 1;
    public string CycleUnit { get; set; } = "days";
    /// <summary>JSON array of dose times in <c>HH:mm</c>.</summary>
    public string TimesJson { get; set; } = "[\"08:00\"]";
    public string Liquid { get; set; } = "No liquid needed";
    public bool WithFood { get; set; }
    public DateOnly StartDate { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
    /// <summary><c>ongoing</c>, or a finite duration measured by <see cref="DurationValue"/>/<see cref="DurationUnit"/>.</summary>
    public string DurationType { get; set; } = "ongoing";
    public int DurationValue { get; set; } = 30;
    public string DurationUnit { get; set; } = "days";
    /// <summary>Doses remaining; decremented when a dose is taken.</summary>
    public int SupplyCount { get; set; } = 30;
    /// <summary>A refill reminder is sent when supply falls to this level.</summary>
    public int RefillThreshold { get; set; } = 7;
    public bool IsRecurring { get; set; } = true;
    /// <summary>First paused date (inclusive).</summary>
    public DateOnly? PauseStartDate { get; set; }
    /// <summary>Last paused date (inclusive); null means paused until resumed.</summary>
    public DateOnly? PauseEndDate { get; set; }

    /// <summary>
    /// First date this medicine no longer occurs because its schedule was rescheduled into a new
    /// medicine record (history before this date stays attached to this record).
    /// </summary>
    public DateOnly? EndedOn { get; set; }

    /// <summary>The medicine record this one replaced when its schedule was rescheduled.</summary>
    public Guid? RescheduledFromId { get; set; }

    /// <summary>JSON array of the dose times before the schedule was rescheduled (shown as "was 8:00 AM").</summary>
    public string? PreviousTimesJson { get; set; }
}

/// <summary>One scheduled dose of a medicine on a date/time, and what happened to it.</summary>
/// <remarks>Status: <c>pending</c>, <c>taken</c>, <c>skipped</c>, <c>missed</c> or <c>rescheduled</c>.</remarks>
public class DoseEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public Guid MedicineId { get; set; }
    public DateOnly Date { get; set; }
    public string Time { get; set; } = "08:00";
    /// <summary>Lifecycle status (see class remarks for allowed values).</summary>
    public string Status { get; set; } = "pending";
    public DateTimeOffset? TakenAt { get; set; }
    public string? SkipReason { get; set; }
    public DateOnly? RescheduleTo { get; set; }
    /// <summary>User who last took/skipped/undid the dose.</summary>
    public Guid? ActionedByUserId { get; set; }
    public DateTimeOffset? MissedAt { get; set; }

    /// <summary>Target time (<c>HH:mm</c>) when this dose was moved; pairs with <see cref="RescheduleTo"/>.</summary>
    public string? RescheduleToTime { get; set; }

    /// <summary>For a dose created by rescheduling: the original dose it replaces.</summary>
    public Guid? RescheduledFromId { get; set; }
}

/// <summary>A sharing group; approved members can access each other's patients.</summary>
public class Family
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "My Family";
    public Guid OwnerUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>Membership of a user in a family.</summary>
public class FamilyMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FamilyId { get; set; }
    public Guid UserId { get; set; }
    public string Status { get; set; } = "approved";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>An invitation to join a family, pending until the invitee responds.</summary>
public class FamilyInvite
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FamilyId { get; set; }
    public Guid InviterUserId { get; set; }
    public Guid InviteeUserId { get; set; }
    /// <summary>Lifecycle status (see class remarks for allowed values).</summary>
    public string Status { get; set; } = "pending";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

/// <summary>An in-app notification (dose reminders, missed doses, refills, invitations).</summary>
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

/// <summary>A browser/device Web Push subscription.</summary>
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

/// <summary>Reservation and outcome of one reminder delivery; its unique index prevents duplicate sends.</summary>
public class NotificationDelivery
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? DoseEventId { get; set; }
    public string Type { get; set; } = "";
    public DateTimeOffset ScheduledFor { get; set; }
    public DateTimeOffset? SentAt { get; set; }
    /// <summary>Lifecycle status (see class remarks for allowed values).</summary>
    public string Status { get; set; } = "pending";
    public string? Error { get; set; }
}

/// <summary>A single-use password reset token (only the SHA-256 hash is stored).</summary>
public class PasswordResetToken
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool Used { get; set; }
}
