using HealthTracker.Api.Models;
using Microsoft.AspNetCore.Identity;

namespace HealthTracker.Api.Services;
public static class ServiceRegistration
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection s)
    {
        s.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();
        return s;
    }
}
