using System.Reflection;
using Microsoft.OpenApi.Models;

namespace HealthTracker.Api.Infrastructure;

/// <summary>
/// OpenAPI/Swagger setup.
/// </summary>
/// <remarks>
/// Endpoint summaries, parameter descriptions and response codes come from the XML doc
/// comments on controllers and contracts (<c>GenerateDocumentationFile</c> is enabled in the
/// project). The UI is served at <c>/swagger</c> in Development, or in any environment when
/// <c>Swagger:Enabled=true</c> is configured.
/// </remarks>
public static class SwaggerRegistration
{
    /// <summary>
    /// Registers the OpenAPI document, XML comments and JWT bearer authentication.
    /// </summary>
    /// <param name="services">The service collection.</param>
    public static IServiceCollection AddSwaggerDocumentation(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Tended Health Tracker API",
                Version = "v1",
                Description =
                    "REST API behind the Tended web and Android apps: authentication, patients, medicines, " +
                    "daily doses, history, family sharing and notifications.\n\n" +
                    "**Authentication:** call `POST /api/auth/login`, then click **Authorize** and paste the `token`.\n\n" +
                    "**Errors:** failures return `application/problem+json` with a human-readable `message`.\n\n" +
                    "**Dates/times:** dates are `YYYY-MM-DD`, dose times are `HH:mm` in the patient owner's time zone."
            });

            var xml = Path.Combine(AppContext.BaseDirectory, $"{Assembly.GetExecutingAssembly().GetName().Name}.xml");
            if (File.Exists(xml))
                options.IncludeXmlComments(xml, includeControllerXmlComments: true);

            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "JWT from /api/auth/login or /api/auth/register."
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    },
                    Array.Empty<string>()
                }
            });
        });
        return services;
    }

    /// <summary>
    /// Serves the OpenAPI JSON and Swagger UI when enabled.
    /// </summary>
    /// <param name="app">The web application.</param>
    public static WebApplication UseSwaggerDocumentation(this WebApplication app)
    {
        var enabled = app.Environment.IsDevelopment() || app.Configuration.GetValue("Swagger:Enabled", false);
        if (!enabled)
            return app;
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "Tended API v1");
            options.DocumentTitle = "Tended API";
            options.DisplayRequestDuration();
        });
        return app;
    }
}
