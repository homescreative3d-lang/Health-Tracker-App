namespace HealthTracker.Api.Contracts;
public record RegisterRequest(string Email,string Password,string DisplayName);public record LoginRequest(string Email,string Password);public record AuthResponse(UserResponse User,string Token);public record UserResponse(Guid Id,string Email,string DisplayName);
public record PatientRequest(string Name,string? Dob,List<string> Conditions,string Notes,string? Relationship);
public record MedicineRequest(string Name,string Strength,string Form,string Condition,string FrequencyPattern,List<string> SpecificDays,int CycleEvery,string CycleUnit,List<string> Times,string Liquid,bool WithFood,string StartDate,string DurationType,int DurationValue,string DurationUnit,int SupplyCount,int RefillThreshold);
public record MedicineResponse(Guid Id,string PatientId,string PatientName,string Name,string Strength,string Form,string Condition,string FrequencyPattern,List<string> SpecificDays,int CycleEvery,string CycleUnit,List<string> Times,string Liquid,bool WithFood,string StartDate,string DurationType,int DurationValue,string DurationUnit,int SupplyCount,int RefillThreshold);
public record DoseResponse(Guid Id,Guid MedicineId,string PatientId,string PatientName,string MedName,string Strength,string Form,string Condition,string Time,string Liquid,bool WithFood,string Status,DateTimeOffset? TakenAt,string? SkipReason,string? RescheduleTo,Guid? ActionedByUserId);
public record ReasonRequest(string Reason);public record RescheduleRequest(string Date);
public record FamilyCreateRequest(string Name);public record FamilyInviteRequest(Guid UserId);public record FamilyInviteResponse(bool Accept);

public record FamilyCreateRequest(string Name);public record FamilyInviteRequest(Guid UserId);public record FamilyInviteResponse(bool Accept);