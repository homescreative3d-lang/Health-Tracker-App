using Amazon.S3;
using Amazon.S3.Model;

namespace HealthTracker.Api.Services;

public interface INeonObjectStorage
{
    bool IsConfigured { get; }
    Task<string> PutDataUrlAsync(string bucket,string key,string dataUrl,CancellationToken ct=default);
    Task DeleteAsync(string bucket,string key,CancellationToken ct=default);
    string GetReadUrl(string bucket,string key);
}

public sealed class NeonObjectStorage : INeonObjectStorage
{
    private readonly IAmazonS3 _s3;
    private readonly IConfiguration _config;
    private readonly ILogger<NeonObjectStorage> _log;
    public bool IsConfigured { get; }

    public NeonObjectStorage(IConfiguration config,ILogger<NeonObjectStorage> log)
    {
        _config=config; _log=log;
        var endpoint=config["AWS_ENDPOINT_URL_S3"];
        var key=config["AWS_ACCESS_KEY_ID"];
        var secret=config["AWS_SECRET_ACCESS_KEY"];
        var region=config["AWS_REGION"] ?? "us-east-2";
        IsConfigured=!string.IsNullOrWhiteSpace(endpoint)&&!string.IsNullOrWhiteSpace(key)&&!string.IsNullOrWhiteSpace(secret);
        if(!IsConfigured){_s3=null!;return;}
        _s3=new AmazonS3Client(key,secret,new AmazonS3Config
        {
            ServiceURL=endpoint,
            ForcePathStyle=true,
            AuthenticationRegion=region
        });
    }

    public async Task<string> PutDataUrlAsync(string bucket,string key,string dataUrl,CancellationToken ct=default)
    {
        if(!IsConfigured) throw new InvalidOperationException("Neon Object Storage is not configured.");
        if(string.IsNullOrWhiteSpace(dataUrl)) throw new ArgumentException("Image data is required.");
        var comma=dataUrl.IndexOf(',');
        if(!dataUrl.StartsWith("data:image/",StringComparison.OrdinalIgnoreCase)||comma<0)
            throw new ArgumentException("Image must be a valid image data URL.");
        var meta=dataUrl[5..comma];
        var mime=meta.Split(';')[0].Trim().ToLowerInvariant();
        var allowed=new[]{"image/jpeg","image/png","image/webp","image/gif"};
        if(!allowed.Contains(mime)) throw new ArgumentException("Only JPEG, PNG, WebP and GIF images are supported.");
        var bytes=Convert.FromBase64String(dataUrl[(comma+1)..]);
        if(bytes.Length>1024*1024) throw new ArgumentException("Image must be 1 MB or smaller.");
        await using var stream=new MemoryStream(bytes);
        await _s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName=bucket, Key=key, InputStream=stream, ContentType=mime
        },ct);
        return key;
    }

    public async Task DeleteAsync(string bucket,string key,CancellationToken ct=default)
    {
        if(!IsConfigured||string.IsNullOrWhiteSpace(key)||key.StartsWith("data:",StringComparison.OrdinalIgnoreCase)) return;
        try{await _s3.DeleteObjectAsync(bucket,key,ct);}catch(Exception ex){_log.LogWarning(ex,"Unable to delete object {Bucket}/{Key}",bucket,key);}
    }

    public string GetReadUrl(string bucket,string key)
    {
        if(!IsConfigured||string.IsNullOrWhiteSpace(key)) return "";
        return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName=bucket, Key=key, Expires=DateTime.UtcNow.AddHours(1),Verb=HttpVerb.GET
        });
    }
}
