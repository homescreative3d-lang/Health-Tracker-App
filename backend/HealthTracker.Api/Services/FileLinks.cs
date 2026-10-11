using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HealthTracker.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Services;

/// <summary>What a file link points to (only ever exists inside an encrypted token).</summary>
/// <param name="B">Bucket.</param>
/// <param name="K">Object key.</param>
/// <param name="N">Download file name (optional).</param>
/// <param name="E">Expiry (Unix seconds).</param>
public record FileTicket(string B, string K, string? N, long E);

/// <summary>
/// Creates and reads opaque, expiring links to stored files served by <c>GET /api/files/{token}</c>.
/// </summary>
/// <remarks>
/// Browsers never see the storage bucket, object path or the storage provider's URL: the token is
/// AES-256-GCM encrypted (tamper-proof) with a key generated once and kept in <c>ServerSettings</c>
/// (shared by every instance). Links expire after one hour, like the signed URLs they replace.
/// </remarks>
public sealed class FileLinks(IHttpContextAccessor http, IConfiguration config)
{
    private const string KeySetting = "files.tokenKey";
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(1);
    private byte[] key = [];

    /// <summary>Loads (or creates once) the encryption key.</summary>
    public static async Task InitializeAsync(IServiceProvider services)
    {
        var links = services.GetRequiredService<FileLinks>();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO \"ServerSettings\" (\"Key\", \"Value\", \"UpdatedAt\") VALUES ({0}, {1}, now()) ON CONFLICT (\"Key\") DO NOTHING;",
            KeySetting, Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));
        var stored = await db.ServerSettings.Where(s => s.Key == KeySetting).Select(s => s.Value).FirstAsync();
        links.key = Convert.FromBase64String(stored);
    }

    /// <summary>Uses a specific 32-byte key (tests and tooling; production loads it via <see cref="InitializeAsync"/>).</summary>
    public void UseKey(byte[] value) => key = value.Length == 32 ? value : throw new ArgumentException("Key must be 32 bytes.");

    /// <summary>
    /// Absolute proxy URL for a stored object, e.g. <c>https://api.example.com/api/files/AbC…</c>.
    /// </summary>
    /// <param name="bucket">Bucket.</param>
    /// <param name="objectKey">Object key.</param>
    /// <param name="fileName">Optional friendly download name.</param>
    public string Link(string bucket, string objectKey, string? fileName = null)
    {
        if (key.Length == 0 || string.IsNullOrWhiteSpace(objectKey))
            return "";
        var ticket = new FileTicket(bucket, objectKey, fileName, DateTimeOffset.UtcNow.Add(Lifetime).ToUnixTimeSeconds());
        var plain = JsonSerializer.SerializeToUtf8Bytes(ticket);
        var nonce = RandomNumberGenerator.GetBytes(12);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using (var aes = new AesGcm(key, 16))
            aes.Encrypt(nonce, plain, cipher, tag);
        var token = Base64Url(nonce.Concat(tag).Concat(cipher).ToArray());
        return $"{BaseUrl()}/api/files/{token}";
    }

    /// <summary>
    /// Decrypts and validates a token.
    /// </summary>
    /// <returns>The ticket, or null when the token is invalid, tampered with or expired.</returns>
    public FileTicket? Read(string token)
    {
        try
        {
            var raw = FromBase64Url(token);
            if (raw.Length < 29 || key.Length == 0)
                return null;
            var nonce = raw[..12];
            var tag = raw[12..28];
            var cipher = raw[28..];
            var plain = new byte[cipher.Length];
            using (var aes = new AesGcm(key, 16))
                aes.Decrypt(nonce, cipher, tag, plain);
            var ticket = JsonSerializer.Deserialize<FileTicket>(plain);
            return ticket is not null && ticket.E >= DateTimeOffset.UtcNow.ToUnixTimeSeconds() ? ticket : null;
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or JsonException)
        {
            return null;
        }
    }

    /// <summary>The API's public base URL (config <c>Api:PublicUrl</c>, else the current request's host).</summary>
    private string BaseUrl()
    {
        var configured = config["Api:PublicUrl"];
        if (!string.IsNullOrWhiteSpace(configured))
            return configured.TrimEnd('/');
        var req = http.HttpContext?.Request;
        if (req is null)
            return "";
        var scheme = req.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? req.Scheme;
        return $"{scheme}://{req.Host}{req.PathBase}";
    }

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string s)
    {
        var b = s.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(b + new string('=', (4 - b.Length % 4) % 4));
    }
}
