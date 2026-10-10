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
}
