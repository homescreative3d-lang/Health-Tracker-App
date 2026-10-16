using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Data;

/// <summary>
/// Creates or upgrades the database schema when the API starts.
/// </summary>
/// <remarks>
/// Moved verbatim from <c>Program.cs</c>; the SQL is unchanged. The project does not use EF
/// migrations yet, so new columns are added with idempotent <c>ALTER TABLE ... IF NOT EXISTS</c>.
/// Adopting EF Core migrations is recommended before the schema grows further.
/// </remarks>
public static class DatabaseInitializer
{
    /// <summary>
    /// Runs schema creation/upgrade and the notification runtime-config migration.
    /// </summary>
    /// <param name="services">Root service provider; a scope is created for the context.</param>
    public static async Task InitializeAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await EnsureSchemaAsync(db);
        await BackfillStockAsync(db);
        await MigrateNotificationRuntimeConfigAsync(db);
    }

    /// <summary>
    /// Creates all tables on an empty database, otherwise adds columns introduced after the first release.
    /// </summary>
    /// <param name="db">Database context.</param>
    private static async Task EnsureSchemaAsync(AppDbContext db)
    {
        if (db.Database.IsNpgsql())
        {
            await db.Database.OpenConnectionAsync();
            try
            {
                using var command = db.Database.GetDbConnection().CreateCommand();
                command.CommandText = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Users');";
                var hasUsers = (bool)(await command.ExecuteScalarAsync())!;
                if (!hasUsers)
                {
                    var script = db.Database.GenerateCreateScript();
                    await db.Database.ExecuteSqlRawAsync(script);
                }
                else
                {
                    command.CommandText = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Patients');";
                    var hasPatients = (bool)(await command.ExecuteScalarAsync())!;
                    if (hasPatients)
                    {
                        await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Patients\" ADD COLUMN IF NOT EXISTS \"ProfileImageUrl\" text;");
                        await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Patients\" ADD COLUMN IF NOT EXISTS \"DoctorPhotoUrl\" text;");
                        await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Patients\" ADD COLUMN IF NOT EXISTS \"AttachmentsJson\" text NOT NULL DEFAULT $$[]$$;");
                    }

                    // Rescheduling support (dose-level and medicine-level). Idempotent.
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"DoseEvents\" ADD COLUMN IF NOT EXISTS \"RescheduleToTime\" text;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"DoseEvents\" ADD COLUMN IF NOT EXISTS \"RescheduledFromId\" uuid;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Medicines\" ADD COLUMN IF NOT EXISTS \"EndedOn\" date;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Medicines\" ADD COLUMN IF NOT EXISTS \"RescheduledFromId\" uuid;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Medicines\" ADD COLUMN IF NOT EXISTS \"PreviousTimesJson\" text;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Medicines\" ADD COLUMN IF NOT EXISTS \"DoseAmount\" text NOT NULL DEFAULT '';");

                    // Family roles, permissions and picture. Existing family creators become admins.
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"FamilyMembers\" ADD COLUMN IF NOT EXISTS \"Role\" text NOT NULL DEFAULT 'member';");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"FamilyMembers\" ADD COLUMN IF NOT EXISTS \"CanManageMembers\" boolean NOT NULL DEFAULT false;");
                    await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Families\" ADD COLUMN IF NOT EXISTS \"PhotoKey\" text;");
                    await db.Database.ExecuteSqlRawAsync("UPDATE \"FamilyMembers\" m SET \"Role\" = 'admin' FROM \"Families\" f WHERE m.\"FamilyId\" = f.\"Id\" AND m.\"UserId\" = f.\"OwnerUserId\" AND m.\"Role\" <> 'admin';");

                    // Server settings (generated push keys) and structured medical history. Idempotent.
                    await db.Database.ExecuteSqlRawAsync("""
                        CREATE TABLE IF NOT EXISTS "ServerSettings" (
                            "Key" text NOT NULL CONSTRAINT "PK_ServerSettings" PRIMARY KEY,
                            "Value" text NOT NULL,
                            "UpdatedAt" timestamp with time zone NOT NULL);
                        CREATE TABLE IF NOT EXISTS "MedicalRecords" (
                            "Id" uuid NOT NULL CONSTRAINT "PK_MedicalRecords" PRIMARY KEY,
                            "PatientId" uuid NOT NULL,
                            "Date" date NULL,
                            "Type" text NOT NULL,
                            "Title" text NOT NULL,
                            "Details" text NOT NULL,
                            "Doctor" text NOT NULL,
                            "Facility" text NOT NULL,
                            "MedicinesJson" text NOT NULL,
                            "SourceKey" text NULL,
                            "SourceMimeType" text NULL,
                            "AiExtracted" boolean NOT NULL,
                            "CreatedByUserId" uuid NOT NULL,
                            "CreatedAt" timestamp with time zone NOT NULL,
                            "UpdatedAt" timestamp with time zone NOT NULL);
                        CREATE INDEX IF NOT EXISTS "IX_MedicalRecords_PatientId" ON "MedicalRecords" ("PatientId");
                        CREATE TABLE IF NOT EXISTS "AuditLogs" (
                            "Id" uuid NOT NULL CONSTRAINT "PK_AuditLogs" PRIMARY KEY,
                            "PatientId" uuid NULL,
                            "EntityType" text NOT NULL,
                            "EntityId" uuid NOT NULL,
                            "MedicineId" uuid NULL,
                            "Action" text NOT NULL,
                            "ActorUserId" uuid NOT NULL,
                            "ActorName" text NOT NULL,
                            "Reason" text NOT NULL,
                            "Summary" text NOT NULL,
                            "DetailsJson" text NOT NULL,
                            "At" timestamp with time zone NOT NULL);
                        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_PatientId_At" ON "AuditLogs" ("PatientId", "At");
                        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_MedicineId" ON "AuditLogs" ("MedicineId");
                        CREATE TABLE IF NOT EXISTS "FeatureFlags" (
                            "Key" text NOT NULL CONSTRAINT "PK_FeatureFlags" PRIMARY KEY,
                            "Enabled" boolean NOT NULL,
                            "Description" text NOT NULL,
                            "UpdatedAt" timestamp with time zone NOT NULL);
                        CREATE TABLE IF NOT EXISTS "UserFeatureOverrides" (
                            "UserId" uuid NOT NULL,
                            "Key" text NOT NULL,
                            "Enabled" boolean NOT NULL,
                            "UpdatedAt" timestamp with time zone NOT NULL,
                            CONSTRAINT "PK_UserFeatureOverrides" PRIMARY KEY ("UserId", "Key"));
                        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "Phone" text NOT NULL DEFAULT '';
                        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "IsDeleted" boolean NOT NULL DEFAULT false;
                        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "DeletedAt" timestamp with time zone NULL;
                        ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "Email" text NOT NULL DEFAULT '';
                        ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "LinkedUserId" uuid NULL;
                        ALTER TABLE "Patients" ADD COLUMN IF NOT EXISTS "CanMarkOwnDoses" boolean NOT NULL DEFAULT false;
                        CREATE INDEX IF NOT EXISTS "IX_Patients_LinkedUserId" ON "Patients" ("LinkedUserId");
                        ALTER TABLE "Medicines" ADD COLUMN IF NOT EXISTS "StockQuantity" numeric(12,3) NOT NULL DEFAULT 0;
                        ALTER TABLE "Medicines" ADD COLUMN IF NOT EXISTS "StockUnit" text NOT NULL DEFAULT '';
                        ALTER TABLE "Medicines" ADD COLUMN IF NOT EXISTS "PrescribedBy" text NOT NULL DEFAULT '';
                        ALTER TABLE "Medicines" ADD COLUMN IF NOT EXISTS "LastRefillAt" timestamp with time zone NULL;
                        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "AiScanDailyLimit" integer NULL;
                        ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "AlertMode" text NOT NULL DEFAULT 'notification';
                        CREATE TABLE IF NOT EXISTS "RefillLogs" (
                            "Id" uuid NOT NULL CONSTRAINT "PK_RefillLogs" PRIMARY KEY,
                            "MedicineId" uuid NOT NULL,
                            "PatientId" uuid NOT NULL,
                            "Kind" text NOT NULL,
                            "Quantity" numeric(12,3) NOT NULL,
                            "Unit" text NOT NULL,
                            "StockAfter" numeric(12,3) NOT NULL,
                            "Pharmacy" text NOT NULL,
                            "Note" text NOT NULL,
                            "ActorUserId" uuid NOT NULL,
                            "ActorName" text NOT NULL,
                            "At" timestamp with time zone NOT NULL);
                        CREATE INDEX IF NOT EXISTS "IX_RefillLogs_MedicineId" ON "RefillLogs" ("MedicineId");
                        CREATE TABLE IF NOT EXISTS "AiScanLogs" (
                            "Id" uuid NOT NULL CONSTRAINT "PK_AiScanLogs" PRIMARY KEY,
                            "UserId" uuid NOT NULL,
                            "At" timestamp with time zone NOT NULL,
                            "Succeeded" boolean NOT NULL);
                        CREATE INDEX IF NOT EXISTS "IX_AiScanLogs_UserId_At" ON "AiScanLogs" ("UserId", "At");
                        INSERT INTO "ServerSettings" ("Key", "Value", "UpdatedAt") VALUES ('ai.scanDailyLimit', '5', now()) ON CONFLICT ("Key") DO NOTHING;
                        INSERT INTO "ServerSettings" ("Key", "Value", "UpdatedAt") VALUES ('doses.actionWindowHours', '12', now()) ON CONFLICT ("Key") DO NOTHING;
                        -- Future dose rows created only because someone viewed a future day: never actioned, safe to drop
                        -- (future doses are now computed on the fly). Moved doses and anything actioned are kept.
                        DELETE FROM "DoseEvents" d
                         WHERE d."Date" > current_date
                           AND d."Status" = 'pending'
                           AND d."RescheduledFromId" IS NULL
                           AND d."ActionedByUserId" IS NULL
                           AND NOT EXISTS (SELECT 1 FROM "DoseEvents" o WHERE o."RescheduledFromId" = d."Id");
                        """);
                }
            }
            finally
            {
                await db.Database.CloseConnectionAsync();
            }
        }
        else
            await db.Database.EnsureCreatedAsync();
    }

    /// <summary>
    /// Creates the single-row <c>NotificationRuntimeConfig</c> table that selects which scheduler
    /// implementation (.NET or Go) is active, migrating the legacy key/value table if present.
    /// </summary>
    /// <param name="db">Database context.</param>
    private static async Task MigrateNotificationRuntimeConfigAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            DO $migration$
            BEGIN
                IF to_regclass('"NotificationRuntimeConfig"') IS NOT NULL
                   AND EXISTS (
                       SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public'
                         AND table_name = 'NotificationRuntimeConfig'
                         AND column_name = 'Key'
                   )
                   AND NOT EXISTS (
                       SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public'
                         AND table_name = 'NotificationRuntimeConfig'
                         AND column_name = 'Id'
                   )
                   AND to_regclass('"NotificationRuntimeConfigLegacy"') IS NULL THEN
                    ALTER TABLE "NotificationRuntimeConfig" RENAME TO "NotificationRuntimeConfigLegacy";
                END IF;
            END
            $migration$;

            CREATE TABLE IF NOT EXISTS "NotificationRuntimeConfigLegacy" (
                "Key" text PRIMARY KEY,
                "Value" text NOT NULL
            );

            CREATE TABLE IF NOT EXISTS "NotificationRuntimeConfig" (
                "Id" integer PRIMARY KEY CHECK ("Id" = 1),
                "Enabled" boolean NOT NULL DEFAULT true,
                "ActiveProvider" text NOT NULL DEFAULT 'dotnet'
                    CHECK ("ActiveProvider" IN ('dotnet', 'go')),
                "UpdatedAt" timestamptz NOT NULL DEFAULT now()
            );

            INSERT INTO "NotificationRuntimeConfig" ("Id", "Enabled", "ActiveProvider")
            VALUES (
                1,
                true,
                COALESCE(
                    (SELECT CASE WHEN "Value" = 'go' THEN 'go' ELSE 'dotnet' END
                     FROM "NotificationRuntimeConfigLegacy"
                     WHERE "Key" = 'NotificationSchedulerProvider'
                     LIMIT 1),
                    'dotnet'
                )
            )
            ON CONFLICT ("Id") DO NOTHING;
            """);
    }

    /// <summary>
    /// One-time conversion of dose-count supply into quantity stock (e.g. 30 doses of ½ tablet =
    /// 15 tablets) and an "opening stock" refill entry so every medicine has a fill trail.
    /// Only touches medicines whose stock unit hasn't been set yet, so it is safe to run every start.
    /// </summary>
    /// <param name="db">Database context.</param>
    private static async Task BackfillStockAsync(AppDbContext db)
    {
        var pending = await db.Medicines.Where(m => m.StockUnit == "").ToListAsync();
        foreach (var m in pending)
        {
            var (perDose, unit) = Domain.DoseQuantity.Parse(m.DoseAmount, m.Form);
            m.StockUnit = unit;
            m.StockQuantity = m.SupplyCount * perDose;
            if (!await db.RefillLogs.AnyAsync(r => r.MedicineId == m.Id))
                db.RefillLogs.Add(new Models.RefillLog
                {
                    MedicineId = m.Id,
                    PatientId = m.PatientId,
                    Kind = "opening",
                    Quantity = m.StockQuantity,
                    Unit = unit,
                    StockAfter = m.StockQuantity,
                    Note = "Stock on hand when refill tracking started",
                    ActorName = "System",
                    At = new DateTimeOffset(m.StartDate.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero)
                });
        }

        if (pending.Count > 0)
            await db.SaveChangesAsync();
    }
}
