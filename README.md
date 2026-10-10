# Tended Health Tracker

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

## Architecture

### Frontend (`frontend/src`)

| Folder | Responsibility |
| --- | --- |
| `api/` | Typed endpoints (`endpoints.ts`), HTTP client with `ApiError`, token store, Web Push helper. |
| `hooks/useCareApp.ts` | Controller hook that owns all app state and actions, shared through `CareAppContext`. |
| `screens/` | Presentational screens (auth, onboarding, hub tabs, notifications, modals). |
| `components/` | Shared UI: `Modal`, `DoseRow`, `DoseGroup`, `AppNav`, `ImagePickerButtons`, `Avatar`... |
| `lib/` | Pure helpers: local-time dates, dose action window, file reading, text formatting. |
| `styles/` | Design tokens and CSS layers: tokens → base → layout → components → screens → motion. |

Responsive breakpoints are defined once in `styles/layout.css`:
- **Phone (under 640px):** bottom tab bar.
- **Tablet (640–1023px):** icon rail.
- **Desktop (1024px and up):** sidebar.

The active tab lives in the URL hash (`#/medicines`), so the Back button moves between tabs.

### Backend (`backend/HealthTracker.Api`)

- **Database:** `Data/DatabaseRegistration.cs` builds a single `NpgsqlDataSource`, which is the one connection pool for the whole process. `AppDbContext` is pooled with `AddDbContextPool`; it is intentionally not a singleton, because EF contexts aren't thread-safe.
- **Shared business rules:**
  - `Domain/DoseSchedule.cs` holds the scheduling rules used by both `DoseService` and `NotificationScheduler`.
  - `Services/PatientAccessService.cs` holds the "who can see this patient" rule.
- **Errors:** `Infrastructure/GlobalExceptionHandler.cs` returns `application/problem+json` responses with a `message` field.

### Landing page and brand

- **Landing page:** signed-out visitors see the page in `frontend/src/screens/landing/`. All copy and optional media live in `landingContent.ts`. To show a real photo or video instead of the animated phone preview, set a slide's `media` field.
- **Logo:** the mark (`public/tended-icon.svg`, plus the inline `components/LogoMark.tsx`) is four pill-organizer compartments with a check.
- **Font:** Poppins is self-hosted through `@fontsource/poppins`.

### API documentation (Swagger)

1. Run the API in Development, or set `Swagger__Enabled=true` in any environment.
2. Open `/swagger`.
3. Call `POST /api/auth/login`, click **Authorize**, and paste the returned `token`.

Every endpoint shows its summary, parameters and possible response codes, generated from the XML doc comments.

## Android app (next step)

The web UI is built to be wrapped unchanged with [Capacitor](https://capacitorjs.com/):
- Layouts respect safe-area insets (`viewport-fit=cover`).
- Touch targets are at least 44px.
- Navigation is hash-based, so the Android back button maps to `history.back()`.
- The token store is isolated in `api/tokenStore.ts`.

Suggested follow-up PR:

```bash
cd frontend
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init Tended com.tended.app --web-dir dist
npm run build && npx cap add android && npx cap open android
```

Then:
- Replace `tokenStore` with `@capacitor/preferences` or secure storage.
- Use `@capacitor/push-notifications` (FCM), because Web Push isn't available in Android WebViews.
- Add the app's origin (`capacitor://localhost` / `https://localhost`) to the API CORS policy.

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
