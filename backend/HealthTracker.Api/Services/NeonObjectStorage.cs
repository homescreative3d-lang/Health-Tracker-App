using Amazon.S3;
using Amazon.S3.Model;

namespace HealthTracker.Api.Services;
/// <summary>
/// S3-compatible object storage (Neon) for profile photos and patient attachments.
/// </summary>
public interface INeonObjectStorage
{
    /// <summary>True when endpoint and credentials are configured.</summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Stores an image sent as a <c>data:image/...;base64</c> URL (JPEG, PNG, WebP, GIF, HEIC/HEIF; max 1 MB).
    /// </summary>
    /// <param name="bucket">Bucket name.</param>
    /// <param name="key">Object key.</param>
    /// <param name="dataUrl">Image data URL.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The stored object key.</returns>
    /// <exception cref="ArgumentException">Unsupported type or too large.</exception>
    Task<string> PutDataUrlAsync(string bucket, string key, string dataUrl, CancellationToken ct = default);

    /// <summary>
    /// Stores an attachment (image, PDF or XLSX; max 10 MB) sent as a base64 data URL.
    /// </summary>
    /// <returns>Key, normalized MIME type and size in bytes.</returns>
    /// <exception cref="ArgumentException">Unsupported type or too large.</exception>
    Task<(string Key, string MimeType, long Size)> PutFileDataUrlAsync(string bucket, string key, string mimeType, string dataUrl, CancellationToken ct = default);

    /// <summary>Deletes an object; failures are logged, not thrown.</summary>
    Task DeleteAsync(string bucket, string key, CancellationToken ct = default);

    /// <summary>Returns a pre-signed GET URL valid for one hour (empty when not configured).</summary>
    string GetReadUrl(string bucket, string key);
}

/// <summary>
/// AWS SDK implementation of <see cref="INeonObjectStorage"/>; registered as a singleton because the S3 client is thread-safe.
/// Configured by <c>AWS_ENDPOINT_URL_S3</c>, <c>AWS_ACCESS_KEY_ID</c>, <c>AWS_SECRET_ACCESS_KEY</c> and <c>AWS_REGION</c>.
/// </summary>
public sealed class NeonObjectStorage : INeonObjectStorage
{
    private readonly IAmazonS3 _s3;
    private readonly IConfiguration _config;
    private readonly ILogger<NeonObjectStorage> _log;
    public bool IsConfigured { get; }

    /// <summary>Creates the S3 client when storage is configured.</summary>
    public NeonObjectStorage(IConfiguration config, ILogger<NeonObjectStorage> log)
    {
        _config = config;
        _log = log;
        var endpoint = config["AWS_ENDPOINT_URL_S3"];
        var key = config["AWS_ACCESS_KEY_ID"];
        var secret = config["AWS_SECRET_ACCESS_KEY"];
        var region = config["AWS_REGION"] ?? "us-east-2";
        IsConfigured = !string.IsNullOrWhiteSpace(endpoint) && !string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(secret);
        if (!IsConfigured)
        {
            _s3 = null!;
            return;
        }

        _s3 = new AmazonS3Client(key, secret, new AmazonS3Config { ServiceURL = endpoint, ForcePathStyle = true, AuthenticationRegion = region });
    }

    /// <inheritdoc />
    public async Task<string> PutDataUrlAsync(string bucket, string key, string dataUrl, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Neon Object Storage is not configured.");
        if (string.IsNullOrWhiteSpace(dataUrl))
            throw new ArgumentException("Image data is required.");
        var comma = dataUrl.IndexOf(',');
        if (!dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) || comma < 0)
            throw new ArgumentException("Image must be a valid image data URL.");
        var meta = dataUrl[5..comma];
        var mime = meta.Split(';')[0].Trim().ToLowerInvariant();
        var allowed = new[]
        {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif"
        };
        if (!allowed.Contains(mime))
            throw new ArgumentException("Only JPEG, PNG, WebP, GIF and HEIC/HEIF images are supported.");
        var bytes = Convert.FromBase64String(dataUrl[(comma + 1)..]);
        if (bytes.Length > 1024 * 1024)
            throw new ArgumentException("Image must be 1 MB or smaller.");
        await using var stream = new MemoryStream(bytes);
        await _s3.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = key, InputStream = stream, ContentType = mime }, ct);
        return key;
    }

    /// <inheritdoc />
    public async Task<(string Key, string MimeType, long Size)> PutFileDataUrlAsync(string bucket, string key, string mimeType, string dataUrl, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Neon Object Storage is not configured.");
        var comma = dataUrl.IndexOf(',');
        if (comma < 0 || !dataUrl[..comma].Contains(";base64", StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("The selected file could not be read.");
        var mime = mimeType.Trim().ToLowerInvariant();
        var allowed = new[]
        {
            "image/jpeg",
            "image/png",
            "image/heic",
            "image/heif",
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        };
        if (!allowed.Contains(mime))
            throw new ArgumentException("Supported files: JPEG, PNG, HEIC/HEIF, PDF and XLSX.");
        var bytes = Convert.FromBase64String(dataUrl[(comma + 1)..]);
        if (bytes.Length > 10 * 1024 * 1024)
            throw new ArgumentException("Attachments must be 10 MB or smaller.");
        await using var stream = new MemoryStream(bytes);
        await _s3.PutObjectAsync(new PutObjectRequest { BucketName = bucket, Key = key, InputStream = stream, ContentType = mime }, ct);
        return (key, mime, bytes.LongLength);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(string bucket, string key, CancellationToken ct = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(key) || key.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            return;
        try
        {
            await _s3.DeleteObjectAsync(bucket, key, ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Unable to delete object {Bucket}/{Key}", bucket, key);
        }
    }

    /// <inheritdoc />
    public string GetReadUrl(string bucket, string key)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(key))
            return "";
        return _s3.GetPreSignedURL(new GetPreSignedUrlRequest { BucketName = bucket, Key = key, Expires = DateTime.UtcNow.AddHours(1), Verb = HttpVerb.GET });
    }
}
