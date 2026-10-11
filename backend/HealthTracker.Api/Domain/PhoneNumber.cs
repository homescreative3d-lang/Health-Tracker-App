using System.Text.RegularExpressions;

namespace HealthTracker.Api.Domain;

/// <summary>
/// Phone numbers are stored in E.164 form (<c>+</c> country code + number, digits only),
/// which every dialer understands through <c>tel:</c> links.
/// </summary>
public static partial class PhoneNumber
{
    [GeneratedRegex(@"^\+[1-9]\d{6,14}$")]
    private static partial Regex E164();

    /// <summary>
    /// Normalizes user input like "+91 98450-12345" to "+919845012345".
    /// </summary>
    /// <param name="input">Raw input (may be empty).</param>
    /// <returns>The normalized number, or "" for empty input.</returns>
    /// <exception cref="ArgumentException">Not a valid international number with country code.</exception>
    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return "";
        var digits = new string(input.Where(c => char.IsDigit(c) || c == '+').ToArray());
        if (digits.StartsWith("00"))
            digits = "+" + digits[2..];
        if (!E164().IsMatch(digits))
            throw new ArgumentException("Enter the phone number with its country code, e.g. +91 98450 12345.");
        return digits;
    }
}
