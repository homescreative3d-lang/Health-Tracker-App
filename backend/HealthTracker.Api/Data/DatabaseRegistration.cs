using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HealthTracker.Api.Data;

/// <summary>
/// Registers database access for the whole application.
/// </summary>
/// <remarks>
/// <para>
/// A single <see cref="NpgsqlDataSource"/> is built once at startup and registered as a
/// singleton. It owns the one physical connection pool shared by every request and by the
/// background <c>NotificationScheduler</c>, so connection settings are parsed once and
/// connections are reused rather than reopened.
/// </para>
/// <para>
/// <see cref="AppDbContext"/> itself is deliberately <b>not</b> a singleton: EF Core contexts
/// are not thread-safe, and sharing one across concurrent requests corrupts change tracking.
/// Instead contexts are pooled (<c>AddDbContextPool</c>): each request leases a reset context
/// from the pool, and it borrows a connection from the shared data source.
/// </para>
/// </remarks>
public static class DatabaseRegistration
{
    /// <summary>
    /// Adds the shared PostgreSQL data source and the pooled <see cref="AppDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">Reads <c>ConnectionStrings:DefaultConnection</c> or <c>DATABASE_URL</c>.</param>
    /// <returns>The same service collection for chaining.</returns>
    /// <exception cref="InvalidOperationException">No connection string is configured.</exception>
    public static IServiceCollection AddDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = ConnectionStringResolver.Resolve(configuration);
        var dataSource = new NpgsqlDataSourceBuilder(connectionString).Build();
        services.AddSingleton(dataSource);
        services.AddDbContextPool<AppDbContext>(options => options.UseNpgsql(dataSource));
        return services;
    }
}

/// <summary>
/// Resolves the PostgreSQL connection string from configuration.
/// </summary>
public static class ConnectionStringResolver
{
    /// <summary>
    /// Returns an Npgsql connection string, converting <c>postgres://</c> URLs (as provided by
    /// Render/Neon in <c>DATABASE_URL</c>) to key/value form.
    /// </summary>
    /// <param name="configuration">Application configuration.</param>
    /// <returns>A connection string usable by Npgsql.</returns>
    /// <exception cref="InvalidOperationException">Neither setting is present.</exception>
    public static string Resolve(IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("DefaultConnection") ?? configuration["DATABASE_URL"];
        if (string.IsNullOrWhiteSpace(connection))
            throw new InvalidOperationException(
                "A PostgreSQL connection is required. Configure ConnectionStrings__DefaultConnection or DATABASE_URL.");
        return connection.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            || connection.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
            ? FromUri(connection)
            : connection;
    }

    /// <summary>
    /// Converts a <c>postgres://user:pass@host:port/db</c> URL to an Npgsql connection string with SSL required.
    /// </summary>
    /// <param name="raw">The URL.</param>
    /// <returns>The equivalent key/value connection string.</returns>
    public static string FromUri(string raw)
    {
        var uri = new Uri(raw);
        var user = Uri.UnescapeDataString(uri.UserInfo.Split(':')[0]);
        var password = Uri.UnescapeDataString(uri.UserInfo[(uri.UserInfo.IndexOf(':') + 1)..]);
        var database = uri.AbsolutePath.TrimStart('/');
        var port = uri.Port > 0 ? uri.Port : 5432;
        return $"Host={uri.Host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Require;Trust Server Certificate=true";
    }
}
