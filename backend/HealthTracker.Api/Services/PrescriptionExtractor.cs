using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HealthTracker.Api.Services;

/// <summary>A prescribed item read from a prescription.</summary>
/// <param name="Name">Medicine name as written.</param>
/// <param name="Strength">e.g. "500 mg".</param>
/// <param name="Dose">Amount per intake, e.g. "1 tablet".</param>
/// <param name="Frequency">e.g. "twice daily", "1-0-1".</param>
/// <param name="Duration">e.g. "5 days".</param>
/// <param name="Instructions">e.g. "after food".</param>
public record ExtractedMedicine(string Name, string Strength, string Dose, string Frequency, string Duration, string Instructions);

/// <summary>Structured draft read from a prescription image; always reviewed by a person before saving.</summary>
/// <param name="Date">Prescription date <c>YYYY-MM-DD</c>, or empty when unreadable.</param>
/// <param name="Doctor">Prescriber's name.</param>
/// <param name="Facility">Clinic or hospital.</param>
/// <param name="Diagnosis">Diagnosis / reason for visit.</param>
/// <param name="Notes">Advice, follow-up, tests ordered.</param>
/// <param name="Medicines">Prescribed items.</param>
/// <param name="Confidence"><c>high</c>, <c>medium</c> or <c>low</c> (handwriting legibility).</param>
/// <param name="IsPrescription">False when the image doesn't look like a prescription or medical document.</param>
public record PrescriptionDraft(string Date, string Doctor, string Facility, string Diagnosis, string Notes, List<ExtractedMedicine> Medicines, string Confidence, bool IsPrescription);

/// <summary>Reads prescriptions into structured drafts.</summary>
public interface IPrescriptionExtractor
{
    /// <summary>True when an AI key is configured.</summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Extracts a draft from an image or PDF.
    /// </summary>
    /// <param name="mimeType">image/jpeg, image/png, image/webp, image/heic, image/heif or application/pdf.</param>
    /// <param name="base64">File content (no data: prefix).</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="InvalidOperationException">With a user-facing message for every failure (not configured, quota, unreadable).</exception>
    Task<PrescriptionDraft> ExtractAsync(string mimeType, string base64, CancellationToken ct = default);
}

/// <summary>
/// Google Gemini implementation (works with free or paid API keys). Configure <c>GEMINI_API_KEY</c>
/// (or <c>Gemini:ApiKey</c>); optional <c>Gemini:Model</c> (default <c>gemini-2.5-flash</c>).
/// The key is sent in the <c>x-goog-api-key</c> header (never in URLs/logs) and never reaches the browser.
/// </summary>
/// <param name="http">HTTP client from IHttpClientFactory.</param>
/// <param name="config">Configuration.</param>
/// <param name="log">Logger (never logs image content or extracted health data).</param>
public sealed class GeminiPrescriptionExtractor(HttpClient http, IConfiguration config, ILogger<GeminiPrescriptionExtractor> log) : IPrescriptionExtractor
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    private string? ApiKey => config["GEMINI_API_KEY"] ?? config["Gemini:ApiKey"];
    private string Model => config["Gemini:Model"] ?? "gemini-2.5-flash";

    /// <inheritdoc />
    public bool IsEnabled => !string.IsNullOrWhiteSpace(ApiKey);

    private const string Prompt = """
        You read medical prescriptions and doctor's notes (printed or handwritten, any language) for a
        family medication app. Extract ONLY what is written; never guess or invent values. Use empty
        strings for anything missing or illegible. Dates as YYYY-MM-DD (convert dd/mm/yyyy, the common
        Indian format). Translate content to English but keep medicine names exactly as written.
        Frequency shorthand like 1-0-1 means morning-afternoon-night; keep the shorthand and add the
        meaning, e.g. "1-0-1 (morning and night)". Set confidence by legibility. If the image is not a
        prescription or medical document, set isPrescription=false and leave other fields empty.
        """;

    /// <summary>JSON schema Gemini must follow (structured output).</summary>
    private static readonly object Schema = new
    {
        type = "OBJECT",
        properties = new Dictionary<string, object>
        {
            ["date"] = new { type = "STRING" },
            ["doctor"] = new { type = "STRING" },
            ["facility"] = new { type = "STRING" },
            ["diagnosis"] = new { type = "STRING" },
            ["notes"] = new { type = "STRING" },
            ["confidence"] = new { type = "STRING", @enum = new[] { "high", "medium", "low" } },
            ["isPrescription"] = new { type = "BOOLEAN" },
            ["medicines"] = new
            {
                type = "ARRAY",
                items = new
                {
                    type = "OBJECT",
                    properties = new Dictionary<string, object>
                    {
                        ["name"] = new { type = "STRING" },
                        ["strength"] = new { type = "STRING" },
                        ["dose"] = new { type = "STRING" },
                        ["frequency"] = new { type = "STRING" },
                        ["duration"] = new { type = "STRING" },
                        ["instructions"] = new { type = "STRING" }
                    },
                    required = new[] { "name", "strength", "dose", "frequency", "duration", "instructions" }
                }
            }
        },
        required = new[] { "date", "doctor", "facility", "diagnosis", "notes", "medicines", "confidence", "isPrescription" }
    };

    /// <inheritdoc />
    public async Task<PrescriptionDraft> ExtractAsync(string mimeType, string base64, CancellationToken ct = default)
    {
        if (!IsEnabled)
            throw new InvalidOperationException("Prescription scanning isn't set up yet. An admin needs to configure the AI service on the server.");

        var body = new
        {
            contents = new[]
            {
                new { parts = new object[] { new { inline_data = new { mime_type = mimeType, data = base64 } }, new { text = Prompt } } }
            },
            generationConfig = new { temperature = 0, responseMimeType = "application/json", responseSchema = Schema }
        };
        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://generativelanguage.googleapis.com/v1beta/models/{Model}:generateContent")
        {
            Content = new StringContent(JsonSerializer.Serialize(body, Json), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("x-goog-api-key", ApiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(ex, "Gemini request failed");
            throw new InvalidOperationException("The scanning service didn't respond. Please try again in a moment.");
        }

        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            log.LogWarning("Gemini returned {Status}", (int)response.StatusCode);
            throw new InvalidOperationException(response.StatusCode switch
            {
                HttpStatusCode.TooManyRequests => "The free scanning limit was reached for now. Please try again in a minute, or enter the details by hand.",
                HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => "The scanning service rejected the server's key. An admin needs to check the configuration.",
                HttpStatusCode.BadRequest => "This file couldn't be read. Try a clearer, well-lit photo of the prescription.",
                _ => "The scanning service had a problem. Please try again."
            });
        }

        try
        {
            using var doc = JsonDocument.Parse(text);
            var candidate = doc.RootElement.GetProperty("candidates")[0];
            if (candidate.TryGetProperty("finishReason", out var reason) && reason.GetString() is "SAFETY" or "RECITATION" or "PROHIBITED_CONTENT")
                throw new InvalidOperationException("This image couldn't be processed. Please enter the details by hand.");
            var json = candidate.GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? "{}";
            var draft = JsonSerializer.Deserialize<PrescriptionDraft>(json, Json)
                ?? throw new JsonException("empty");
            return draft with { Medicines = draft.Medicines ?? [], Date = NormalizeDate(draft.Date) };
        }
        catch (Exception ex) when (ex is JsonException or KeyNotFoundException or IndexOutOfRangeException or InvalidOperationException { Message: "empty" })
        {
            log.LogWarning("Gemini response could not be parsed: {Type}", ex.GetType().Name);
            throw new InvalidOperationException("The prescription couldn't be read clearly. Try another photo or enter the details by hand.");
        }
    }

    /// <summary>Keeps only valid <c>YYYY-MM-DD</c> dates.</summary>
    private static string NormalizeDate(string? value) =>
        DateOnly.TryParseExact(value ?? "", "yyyy-MM-dd", out var d) ? d.ToString("yyyy-MM-dd") : "";
}
