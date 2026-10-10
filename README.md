# TENDED Health Tracker

Full-stack medication tracker with a React/Vite frontend and ASP.NET Core Web API using EF Core and PostgreSQL.

## Local development (Windows / PowerShell)

Prerequisites:
- Git
- .NET 10 SDK (the API and tests target .NET 10 LTS)
- Node.js 20 or newer
- Docker Desktop

### 1. Start local PostgreSQL

From the repository root:

```powershell
docker compose -f docker-compose.dev.yml up -d postgres
```

This creates a development-only PostgreSQL database on `localhost:5433`. The database volume persists across restarts.

### 2. Start the API

```powershell
cd backend/HealthTracker.Api
dotnet restore
dotnet run
```

The Development launch profile uses the local database and allows the API to start without Neon Object Storage or Web Push credentials. Image uploads require object storage; push delivery requires valid VAPID keys.

API: http://localhost:5000  
Swagger: http://localhost:5000/swagger  
Health: http://localhost:5000/api/health

On first startup, the API creates the application's tables when needed and initializes the singleton `NotificationRuntimeConfig` row. Existing databases get the config table added without replacing their existing data.

### 3. Start the frontend

In a second PowerShell terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally http://localhost:5173).

### 4. Run tests

```powershell
dotnet test backend/HealthTracker.Tests/HealthTracker.Tests.csproj
cd frontend
npm run build
```

## Notification provider switch

The singleton database row in `NotificationRuntimeConfig` is the source of truth for which scheduler is allowed to work. The safe default is `Enabled = true`, `ActiveProvider = 'dotnet'`, preserving the current behavior.

Use DBeaver/psql against your development database to switch providers:

```sql
-- Keep .NET scheduler active
UPDATE "NotificationRuntimeConfig"
SET "Enabled" = true, "ActiveProvider" = 'dotnet', "UpdatedAt" = now()
WHERE "Id" = 1;

-- Enable Go worker only after it has been validated
UPDATE "NotificationRuntimeConfig"
SET "Enabled" = true, "ActiveProvider" = 'go', "UpdatedAt" = now()
WHERE "Id" = 1;

-- Pause notifications from both schedulers
UPDATE "NotificationRuntimeConfig"
SET "Enabled" = false, "UpdatedAt" = now()
WHERE "Id" = 1;
```

The .NET scheduler checks this row on every tick and only schedules/sends when enabled and the active provider is `dotnet`. The Go worker uses the same table and must only process jobs when enabled and the active provider is `go`. Never enable both schedulers simultaneously. Changing the row does not deploy or start the Go worker; it only controls which provider is authorized to process notifications.

See `database/notification-runtime-config.sql` for the schema and switch commands.

## Production safety

- Do not point a local worker at production until integration testing is complete.
- Do not run the Go worker and .NET scheduler as active providers at the same time.
- The worker branch is separate from this API branch; no branch is merged to `main` by this work.
