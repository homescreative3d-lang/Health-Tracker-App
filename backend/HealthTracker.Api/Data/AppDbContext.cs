using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Data;
/// <summary>
/// EF Core context for the Tended database. Registered with <c>AddDbContextPool</c>, so it must stay
/// stateless beyond EF's own change tracking (no per-request fields).
/// </summary>
/// <param name="options">Options built by <see cref="DatabaseRegistration"/>.</param>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<Medicine> Medicines => Set<Medicine>();
    public DbSet<DoseEvent> DoseEvents => Set<DoseEvent>();
    public DbSet<Family> Families => Set<Family>();
    public DbSet<FamilyMember> FamilyMembers => Set<FamilyMember>();
    public DbSet<FamilyInvite> FamilyInvites => Set<FamilyInvite>();
    public DbSet<AppNotification> Notifications => Set<AppNotification>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();
    public DbSet<NotificationDelivery> NotificationDeliveries => Set<NotificationDelivery>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<ServerSetting> ServerSettings => Set<ServerSetting>();
    public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<UserFeatureOverride> UserFeatureOverrides => Set<UserFeatureOverride>();
    public DbSet<RefillLog> RefillLogs => Set<RefillLog>();
    public DbSet<AiScanLog> AiScanLogs => Set<AiScanLog>();

    /// <summary>Configures unique and lookup indexes.</summary>
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ServerSetting>().HasKey(x => x.Key);
        b.Entity<MedicalRecord>().HasIndex(x => x.PatientId);
        b.Entity<AuditLog>().HasIndex(x => new { x.PatientId, x.At });
        b.Entity<AuditLog>().HasIndex(x => x.MedicineId);
        b.Entity<FeatureFlag>().HasKey(x => x.Key);
        b.Entity<UserFeatureOverride>().HasKey(x => new { x.UserId, x.Key });
        b.Entity<Patient>().HasIndex(x => x.LinkedUserId);
        b.Entity<RefillLog>().HasIndex(x => x.MedicineId);
        b.Entity<AiScanLog>().HasIndex(x => new { x.UserId, x.At });
        b.Entity<Medicine>().Property(x => x.StockQuantity).HasPrecision(12, 3);
        b.Entity<RefillLog>().Property(x => x.Quantity).HasPrecision(12, 3);
        b.Entity<RefillLog>().Property(x => x.StockAfter).HasPrecision(12, 3);
        b.Entity<AppUser>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Patient>().HasIndex(x => x.UserId);
        b.Entity<Medicine>().HasIndex(x => x.PatientId);
        b.Entity<DoseEvent>().HasIndex(x => new { x.PatientId, x.MedicineId, x.Date, x.Time }).IsUnique();
        b.Entity<FamilyMember>().HasIndex(x => new { x.FamilyId, x.UserId }).IsUnique();
        b.Entity<FamilyInvite>().HasIndex(x => new { x.FamilyId, x.InviteeUserId, x.Status });
        b.Entity<AppNotification>().HasIndex(x => new { x.UserId, x.IsRead });
        b.Entity<PushSubscription>().HasIndex(x => new { x.UserId, x.Endpoint }).IsUnique();
        b.Entity<NotificationDelivery>().HasIndex(x => new { x.DoseEventId, x.UserId, x.Type, x.ScheduledFor }).IsUnique();
        b.Entity<PasswordResetToken>().HasIndex(x => x.TokenHash).IsUnique();
    }
}
