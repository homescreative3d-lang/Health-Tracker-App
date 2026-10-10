using System.Text;using HealthTracker.Api.Data;using HealthTracker.Api.Services;using Microsoft.AspNetCore.Authentication.JwtBearer;using Microsoft.EntityFrameworkCore;using Microsoft.IdentityModel.Tokens;using Microsoft.OpenApi.Models;
var builder=WebApplication.CreateBuilder(args);
builder.Services.AddControllers();builder.Services.AddEndpointsApiExplorer();builder.Services.AddSwaggerGen(o=>{o.AddSecurityDefinition("Bearer",new OpenApiSecurityScheme{Type=SecuritySchemeType.Http,Scheme="bearer",BearerFormat="JWT",In=ParameterLocation.Header});o.AddSecurityRequirement(new OpenApiSecurityRequirement{{new OpenApiSecurityScheme{Reference=new OpenApiReference{Type=ReferenceType.SecurityScheme,Id="Bearer"}},Array.Empty<string>()}});});
var connection=builder.Configuration.GetConnectionString("DefaultConnection")??builder.Configuration["DATABASE_URL"];
if(!string.IsNullOrWhiteSpace(connection)){if(connection.StartsWith("postgres://",StringComparison.OrdinalIgnoreCase)||connection.StartsWith("postgresql://",StringComparison.OrdinalIgnoreCase))connection=PostgresUriToConnectionString(connection);builder.Services.AddDbContext<AppDbContext>(o=>o.UseNpgsql(connection));}

else throw new InvalidOperationException("A persistent PostgreSQL connection is required outside Development/Testing. Configure ConnectionStrings__DefaultConnection or DATABASE_URL.");
builder.Services.AddApplicationServices();builder.Services.AddScoped<ITokenService,TokenService>();builder.Services.AddScoped<IAuthService,AuthService>();builder.Services.AddScoped<IDoseService,DoseService>();builder.Services.AddScoped<IPushNotificationService,PushNotificationService>();builder.Services.AddSingleton<INeonObjectStorage,NeonObjectStorage>();builder.Services.AddHostedService<NotificationScheduler>();
var jwtKey=builder.Configuration["Jwt:Key"]??throw new InvalidOperationException("Jwt:Key is missing");if(jwtKey.Length<32)throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o=>o.TokenValidationParameters=new TokenValidationParameters{ValidateIssuer=true,ValidateAudience=true,ValidateLifetime=true,ValidateIssuerSigningKey=true,ValidIssuer=builder.Configuration["Jwt:Issuer"]??"HealthTracker",ValidAudience=builder.Configuration["Jwt:Audience"]??"HealthTrackerWeb",IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))});builder.Services.AddAuthorization();builder.Services.AddCors(o=>o.AddPolicy("web",p=>p.WithOrigins((builder.Configuration["Frontend:Url"]??"https://healthsteady.netlify.app").TrimEnd('/')).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
var app=builder.Build();if(!app.Environment.IsDevelopment()&&!app.Environment.IsEnvironment("Testing")&&!app.Services.GetRequiredService<INeonObjectStorage>().IsConfigured)throw new InvalidOperationException("Neon Object Storage is required outside Development/Testing. Configure AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
using(var scope=app.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();if(db.Database.IsNpgsql()){await db.Database.OpenConnectionAsync();try{using var command=db.Database.GetDbConnection().CreateCommand();command.CommandText="SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Users');";var hasUsers=(bool)(await command.ExecuteScalarAsync())!;if(!hasUsers){var script=db.Database.GenerateCreateScript();await db.Database.ExecuteSqlRawAsync(script);}else{command.CommandText="SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Patients');";var hasPatients=(bool)(await command.ExecuteScalarAsync())!;if(hasPatients)await db.Database.ExecuteSqlRawAsync("ALTER TABLE \"Patients\" ADD COLUMN IF NOT EXISTS \"ProfileImageUrl\" text;");}}finally{await db.Database.CloseConnectionAsync();}}else await db.Database.EnsureCreatedAsync();}
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.ExecuteSqlRawAsync("""
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
        """);
}
if(app.Environment.IsDevelopment()){app.UseSwagger();app.UseSwaggerUI();}app.UseCors("web");app.UseAuthentication();app.UseAuthorization();app.MapControllers();app.MapGet("/api/health",async(AppDbContext db)=>{var ok=await db.Database.CanConnectAsync();return ok?Results.Ok(new{status="ok",database="connected",storage=app.Services.GetRequiredService<INeonObjectStorage>().IsConfigured?"configured":"missing"}):Results.StatusCode(503);});app.Run();
static string PostgresUriToConnectionString(string raw){var u=new Uri(raw);var user=Uri.UnescapeDataString(u.UserInfo.Split(':')[0]);var pass=Uri.UnescapeDataString(u.UserInfo[(u.UserInfo.IndexOf(':')+1)..]);var db=u.AbsolutePath.TrimStart('/');var port=u.Port>0?u.Port:5432;return $"Host={u.Host};Port={port};Database={db};Username={user};Password={pass};SSL Mode=Require;Trust Server Certificate=true";}