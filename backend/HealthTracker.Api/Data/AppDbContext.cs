using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Data;
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

    protected override void OnModelCreating(ModelBuilder b)
    {
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
