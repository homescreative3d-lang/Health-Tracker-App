-- Safe default: the existing .NET scheduler remains the active provider.
CREATE TABLE IF NOT EXISTS "NotificationRuntimeConfig" (
    "Id" integer PRIMARY KEY CHECK ("Id" = 1),
    "Enabled" boolean NOT NULL DEFAULT true,
    "ActiveProvider" text NOT NULL DEFAULT 'dotnet'
        CHECK ("ActiveProvider" IN ('dotnet', 'go')),
    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "NotificationRuntimeConfig" ("Id", "Enabled", "ActiveProvider")
VALUES (1, true, 'dotnet')
ON CONFLICT ("Id") DO NOTHING;

-- Use exactly one provider at a time.
-- .NET scheduler:
-- UPDATE "NotificationRuntimeConfig"
-- SET "Enabled" = true, "ActiveProvider" = 'dotnet', "UpdatedAt" = now()
-- WHERE "Id" = 1;

-- Go worker (only after the worker has been tested and deployed):
-- UPDATE "NotificationRuntimeConfig"
-- SET "Enabled" = true, "ActiveProvider" = 'go', "UpdatedAt" = now()
-- WHERE "Id" = 1;

-- Disable all scheduled notifications:
-- UPDATE "NotificationRuntimeConfig"
-- SET "Enabled" = false, "UpdatedAt" = now()
-- WHERE "Id" = 1;

SELECT * FROM "NotificationRuntimeConfig";
