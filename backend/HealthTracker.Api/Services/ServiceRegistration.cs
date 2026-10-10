using System.Text;
using HealthTracker.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace HealthTracker.Api.Services;

/// <summary>
/// Dependency-injection registrations for application services.
/// </summary>
/// <remarks>
/// Lifetimes: request-scoped services share the request's pooled <c>AppDbContext</c>;
/// <see cref="NeonObjectStorage"/> is a singleton because its S3 client is thread-safe and
/// expensive to create; <see cref="NotificationScheduler"/> is a hosted background service that
/// creates its own scope per tick.
/// </remarks>
public static class ServiceRegistration
{
    /// <summary>
    /// Registers domain and infrastructure services.
    /// </summary>
    /// <param name="services">The service collection.</param>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
        services.AddScoped<IPatientAccessService, PatientAccessService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IDoseService, DoseService>();
        services.AddScoped<IPushNotificationService, PushNotificationService>();
        services.AddSingleton<INeonObjectStorage, NeonObjectStorage>();
        services.AddHostedService<NotificationScheduler>();
        return services;
    }

    /// <summary>
    /// Configures JWT bearer authentication from <c>Jwt:Key</c>, <c>Jwt:Issuer</c> and <c>Jwt:Audience</c>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Application configuration.</param>
    /// <exception cref="InvalidOperationException">The signing key is missing or shorter than 32 characters.</exception>
    public static IServiceCollection AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtKey = configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing");
        if (jwtKey.Length < 32)
            throw new InvalidOperationException("Jwt:Key must be at least 32 characters.");
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = configuration["Jwt:Issuer"] ?? "HealthTracker",
                ValidAudience = configuration["Jwt:Audience"] ?? "HealthTrackerWeb",
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
            });
        return services;
    }
}
