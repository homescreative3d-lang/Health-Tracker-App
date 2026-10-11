using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.EntityFrameworkCore;
using WebPush;

namespace HealthTracker.Api.Services;

/// <summary>
/// Holds the Web Push (VAPID) key pair used to sign push messages.
/// </summary>
/// <remarks>
/// Push must work without manual setup, so:
/// <list type="number">
/// <item>If <c>WebPush:PublicKey</c> and <c>WebPush:PrivateKey</c> are configured, they are used.</item>
/// <item>Otherwise a key pair is generated once and stored in the <c>ServerSettings</c> table, so
/// every instance and every restart uses the same keys (changing keys would invalidate every
/// device's subscription).</item>
/// </list>
/// The private key never leaves the server; only the public key is returned by the API.
/// </remarks>
public sealed class VapidKeyStore
{
    private const string PublicKeySetting = "webpush.publicKey";
    private const string PrivateKeySetting = "webpush.privateKey";

    /// <summary>Base64url public key shared with browsers.</summary>
    public string PublicKey { get; private set; } = "";

    /// <summary>Base64url private key used to sign push requests.</summary>
    public string PrivateKey { get; private set; } = "";

    /// <summary>Contact URI sent to push services (mailto: or https:).</summary>
    public string Subject { get; private set; } = "mailto:notifications@tended.app";

    /// <summary><c>configuration</c>, <c>database</c> or <c>generated</c>.</summary>
    public string Source { get; private set; } = "none";

    /// <summary>True when a usable key pair is loaded.</summary>
    public bool IsReady => PublicKey.Length > 0 && PrivateKey.Length > 0;

    /// <summary>
    /// Loads the keys from configuration or the database, generating and persisting a new pair
    /// when none exists. Safe to run concurrently on several instances.
    /// </summary>
    /// <param name="services">Root service provider.</param>
    public static async Task InitializeAsync(IServiceProvider services)
    {
        var store = services.GetRequiredService<VapidKeyStore>();
        var config = services.GetRequiredService<IConfiguration>();
        var log = services.GetRequiredService<ILogger<VapidKeyStore>>();
        store.Subject = Subject_(config);

        var pub = config["WebPush:PublicKey"];
        var priv = config["WebPush:PrivateKey"];
        if (!string.IsNullOrWhiteSpace(pub) && !string.IsNullOrWhiteSpace(priv))
        {
            store.Set(pub.Trim(), priv.Trim(), "configuration");
            return;
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var (dbPub, dbPriv) = await Read(db);
        if (dbPub is null || dbPriv is null)
        {
            var keys = VapidHelper.GenerateVapidKeys();
            // ON CONFLICT DO NOTHING: if another instance won the race, its keys are kept and re-read below.
            await db.Database.ExecuteSqlRawAsync(
                "INSERT INTO \"ServerSettings\" (\"Key\", \"Value\", \"UpdatedAt\") VALUES ({0}, {1}, now()), ({2}, {3}, now()) ON CONFLICT (\"Key\") DO NOTHING;",
                PublicKeySetting, keys.PublicKey, PrivateKeySetting, keys.PrivateKey);
            (dbPub, dbPriv) = await Read(db);
            log.LogInformation("Generated Web Push keys and stored them in ServerSettings.");
            store.Set(dbPub ?? keys.PublicKey, dbPriv ?? keys.PrivateKey, "generated");
            return;
        }

        store.Set(dbPub, dbPriv, "database");
    }

    /// <summary>Reads the stored pair (nulls when missing).</summary>
    private static async Task<(string? Pub, string? Priv)> Read(AppDbContext db)
    {
        var rows = await db.ServerSettings.Where(s => s.Key == PublicKeySetting || s.Key == PrivateKeySetting).ToListAsync();
        return (rows.FirstOrDefault(r => r.Key == PublicKeySetting)?.Value, rows.FirstOrDefault(r => r.Key == PrivateKeySetting)?.Value);
    }

    /// <summary>
    /// Push services require a contact: configured subject, else the frontend URL, else a mailto.
    /// </summary>
    private static string Subject_(IConfiguration config)
    {
        var subject = config["WebPush:Subject"];
        if (!string.IsNullOrWhiteSpace(subject))
            return subject.Trim();
        var site = config["Frontend:Url"];
        return !string.IsNullOrWhiteSpace(site) && site.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? site.TrimEnd('/')
            : "mailto:notifications@tended.app";
    }

    private void Set(string pub, string priv, string source)
    {
        PublicKey = pub;
        PrivateKey = priv;
        Source = source;
    }
}
