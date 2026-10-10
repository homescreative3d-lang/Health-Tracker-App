# TENDED Health Tracker

TENDED is a medication and family-care tracker built with React, ASP.NET Core 8 (LTS), EF Core and PostgreSQL.

## Run locally on Windows

Prerequisites: Git, Docker Desktop, .NET 8 SDK, Node.js 20+, and npm.

### 1. Start a local PostgreSQL database

From the repository root:

```powershell
docker compose -f docker-compose.local.yml up -d
```

The local database is created with development-only credentials. Do not reuse these credentials in production.

### 2. Configure the .NET API

Copy the example settings file to the Development settings file:

```powershell
Copy-Item backend/HealthTracker.Api/appsettings.Development.example.json backend/HealthTracker.Api/appsettings.Development.json
```

Change the local JWT key to a private, random value of at least 32 characters. The example settings file is not loaded automatically; the copied `appsettings.Development.json` is.

Start the API:

```powershell
dotnet restore backend/HealthTracker.Api/HealthTracker.Api.csproj
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project backend/HealthTracker.Api/HealthTracker.Api.csproj --urls http://localhost:5000
```

On first startup, the API creates the database schema when the database is empty and initializes the `NotificationRuntimeConfig` table. Swagger is available at `http://localhost:5000/swagger`.

Web Push is optional for local API startup. To test push notifications, generate VAPID keys and configure `WebPush:PublicKey` and `WebPush:PrivateKey`. A browser subscription is required for each test user. Browsers generally require HTTPS for push except on localhost.

### 3. Configure and run the React app

```powershell
Copy-Item frontend/.env.local.example frontend/.env.local
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The local API allows that origin by default.

### 4. Run checks

From the repository root:

```powershell
dotnet test backend/HealthTracker.Tests/HealthTracker.Tests.csproj
dotnet build backend/HealthTracker.Api/HealthTracker.Api.csproj
cd frontend
npm run build
```

## Notification scheduler switch

The `NotificationRuntimeConfig` table has one controlling row:

| Key | Value | Behaviour |
| --- | --- | --- |
| `NotificationSchedulerProvider` | `dotnet` | The ASP.NET Core hosted scheduler sends notifications. This is the safe default. |
| `NotificationSchedulerProvider` | `go` | The .NET scheduler pauses its notification work; the separate Go worker is allowed to process notifications. |

Change it only after the Go worker has been deployed and validated. Example SQL:

```sql
UPDATE "NotificationRuntimeConfig"
SET "Value" = 'go', "UpdatedAt" = now()
WHERE "Key" = 'NotificationSchedulerProvider';
```

To switch back to .NET:

```sql
UPDATE "NotificationRuntimeConfig"
SET "Value" = 'dotnet', "UpdatedAt" = now()
WHERE "Key" = 'NotificationSchedulerProvider';
```

Never enable both schedulers at the same time. The .NET scheduler checks the flag each tick; the Go worker listens for config changes after its schema setup and also checks the flag before processing jobs.

## Defect fixes in this branch

- Push notifications include medicine name and strength, with Taken/Skip actions that open the app and apply the action after authentication.
- Login keeps profile data hidden behind the loading screen until user data is loaded successfully.
- Logout clears session state and returns the next login to Today.
- Previously actioned doses remain visible after changing the medicine's scheduled times.
- Dose icons reflect medicine form (pill, injection, drops/syrup, inhaler, powder).
- Today's progress refreshes from dose state and explicitly reports skipped/missed doses as missed.
- The API targets .NET 8 LTS and supports a local PostgreSQL + Vite development setup.

Push notification timing is best-effort at approximately five-second scheduler intervals in the .NET fallback. A notification cannot be guaranteed at the exact millisecond, and delivery while the app is closed depends on a valid push subscription, browser/OS support, and notification permissions.
