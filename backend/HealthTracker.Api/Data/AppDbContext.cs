using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
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
    public DbSet<NotificationRuntimeConfig> NotificationRuntimeConfigs => Set<NotificationRuntimeConfig>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasIndex(user => user.Email).IsUnique();
        modelBuilder.Entity<Patient>().HasIndex(patient => patient.UserId);
        modelBuilder.Entity<Medicine>().HasIndex(medicine => medicine.PatientId);
        modelBuilder.Entity<DoseEvent>()
            .HasIndex(dose => new { dose.PatientId, dose.MedicineId, dose.Date, dose.Time })
            .IsUnique();
        modelBuilder.Entity<FamilyMember>()
            .HasIndex(member => new { member.FamilyId, member.UserId })
            .IsUnique();
        modelBuilder.Entity<FamilyInvite>()
            .HasIndex(invite => new { invite.FamilyId, invite.InviteeUserId, invite.Status });
        modelBuilder.Entity<AppNotification>()
            .HasIndex(notification => new { notification.UserId, notification.IsRead });
        modelBuilder.Entity<PushSubscription>()
            .HasIndex(subscription => new { subscription.UserId, subscription.Endpoint })
            .IsUnique();
        modelBuilder.Entity<NotificationDelivery>()
            .HasIndex(delivery => new
            {
                delivery.DoseEventId,
                delivery.UserId,
                delivery.Type,
                delivery.ScheduledFor
            })
            .IsUnique();
        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(token => token.TokenHash)
            .IsUnique();

        modelBuilder.Entity<NotificationRuntimeConfig>(entity =>
        {
            entity.HasKey(config => config.Id);
            entity.Property(config => config.ActiveProvider).HasMaxLength(16);
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_NotificationRuntimeConfig_Id", "\"Id\" = 1");
                table.HasCheckConstraint(
                    "CK_NotificationRuntimeConfig_ActiveProvider",
                    "\"ActiveProvider\" IN ('dotnet', 'go')");
            });
        });
    }
}
