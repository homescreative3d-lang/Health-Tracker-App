using System.Net;
using System.Text;
using HealthTracker.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HealthTracker.Tests;

/// <summary>Gemini prescription extraction: parsing and error mapping, with a fake HTTP handler.</summary>
public class GeminiExtractorTests
{
    /// <summary>Returns a canned response and records the request.</summary>
    private sealed class FakeHandler(HttpStatusCode status, string body) : HttpMessageHandler
    {
        public HttpRequestMessage? Last;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Last = request;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    /// <summary>Builds an extractor with an optional API key and a fake response.</summary>
    private static (GeminiPrescriptionExtractor Extractor, FakeHandler Handler) Make(HttpStatusCode status, string body, string? key = "test-key")
    {
        var handler = new FakeHandler(status, body);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["GEMINI_API_KEY"] = key }).Build();
        return (new GeminiPrescriptionExtractor(new HttpClient(handler), config, NullLogger<GeminiPrescriptionExtractor>.Instance), handler);
    }

    /// <summary>Wraps a JSON string the way Gemini returns structured output.</summary>
    private static string Reply(string json) =>
        "{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[{\"text\":" + System.Text.Json.JsonSerializer.Serialize(json) + "}]}}]}";

    [Fact]
    public async Task ParsesStructuredPrescription()
    {
        var (x, handler) = Make(HttpStatusCode.OK, Reply("""
            {"date":"2026-10-02","doctor":"Dr. Rao","facility":"City Clinic","diagnosis":"Type 2 diabetes","notes":"Review in 1 month",
             "medicines":[{"name":"Metformin","strength":"500 mg","dose":"1 tablet","frequency":"1-0-1 (morning and night)","duration":"30 days","instructions":"after food"}],
             "confidence":"high","isPrescription":true}
            """));
        var draft = await x.ExtractAsync("image/jpeg", "AAAA");
        Assert.Equal("2026-10-02", draft.Date);
        Assert.Equal("Dr. Rao", draft.Doctor);
        Assert.Equal("Metformin", draft.Medicines[0].Name);
        Assert.True(draft.IsPrescription);
        // The key travels in a header, never in the URL.
        Assert.True(handler.Last!.Headers.Contains("x-goog-api-key"));
        Assert.False(handler.Last!.RequestUri!.ToString().Contains("test-key"));
    }

    [Fact]
    public async Task InvalidDatesAreBlanked()
    {
        var (x, _) = Make(HttpStatusCode.OK, Reply("""{"date":"02/10/2026","doctor":"","facility":"","diagnosis":"","notes":"","medicines":[],"confidence":"low","isPrescription":true}"""));
        Assert.Equal("", (await x.ExtractAsync("image/png", "AAAA")).Date);
    }

    [Fact]
    public async Task QuotaErrorBecomesFriendlyMessage()
    {
        var (x, _) = Make(HttpStatusCode.TooManyRequests, "{}");
        var e = await Assert.ThrowsAsync<InvalidOperationException>(() => x.ExtractAsync("image/png", "AAAA"));
        Assert.Contains("limit", e.Message);
    }

    [Fact]
    public async Task MissingKeyExplainsSetup()
    {
        var (x, _) = Make(HttpStatusCode.OK, "{}", key: null);
        Assert.False(x.IsEnabled);
        var e = await Assert.ThrowsAsync<InvalidOperationException>(() => x.ExtractAsync("image/png", "AAAA"));
        Assert.Contains("configure the AI service", e.Message);
    }

    [Fact]
    public async Task GarbageResponseIsHandled()
    {
        var (x, _) = Make(HttpStatusCode.OK, "{\"candidates\":[]}");
        await Assert.ThrowsAsync<InvalidOperationException>(() => x.ExtractAsync("image/png", "AAAA"));
    }
}
