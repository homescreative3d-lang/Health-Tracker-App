using HealthTracker.Api.Data;
using HealthTracker.Api.Infrastructure;
using HealthTracker.Api.Services;
using Microsoft.EntityFrameworkCore;

// Composition root: registers services, configures the HTTP pipeline and starts the API.
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSwaggerDocumentation();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// One shared connection pool + pooled DbContexts (see DatabaseRegistration).
builder.Services.AddDatabase(builder.Configuration);
builder.Services.AddApplicationServices();

builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddAuthorization();
builder.Services.AddCors(options => options.AddPolicy("web", policy => policy
    .WithOrigins(
        (builder.Configuration["Frontend:Url"] ?? "https://healthsteady.netlify.app").TrimEnd('/'),
        (builder.Configuration["Frontend:LocalUrl"] ?? "http://localhost:5173").TrimEnd('/'))
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

if (!app.Environment.IsEnvironment("Testing") && !app.Environment.IsDevelopment()
    && !app.Services.GetRequiredService<INeonObjectStorage>().IsConfigured)
    throw new InvalidOperationException(
        "Neon Object Storage is required. Configure AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");

await DatabaseInitializer.InitializeAsync(app.Services);

app.UseExceptionHandler();
app.UseSwaggerDocumentation();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/api/health", async (AppDbContext db, INeonObjectStorage storage) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "ok", database = "connected", storage = storage.IsConfigured ? "configured" : "missing" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable))
    .WithName("Health")
    .WithTags("Health")
    .WithSummary("Liveness/readiness probe used by Render: checks database connectivity and storage configuration.");

app.Run();

/// <summary>Entry point; partial so integration tests can reference it via WebApplicationFactory.</summary>
public partial class Program;
