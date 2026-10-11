using System.Globalization;
using System.Text.RegularExpressions;

namespace HealthTracker.Api.Domain;

/// <summary>
/// Turns a dose amount as people write it ("½ tablet", "1½ tablets", "5 ml", "2 puffs",
/// "0.5 ml", "10 units") into a number and a stock unit, so stock can be kept as a quantity.
/// </summary>
public static partial class DoseQuantity
{
    private static readonly Dictionary<char, decimal> Fractions = new()
    {
        ['½'] = 0.5m, ['⅓'] = 1m / 3, ['¼'] = 0.25m, ['¾'] = 0.75m, ['⅔'] = 2m / 3, ['⅛'] = 0.125m
    };

    [GeneratedRegex(@"^\s*(\d+(?:[.,]\d+)?)?\s*([½⅓¼¾⅔⅛])?\s*(?:(\d+)\s*/\s*(\d+))?\s*(.*)$")]
    private static partial Regex Pattern();

    /// <summary>Plain fractions: "1/4 tablet" or mixed "1 1/2 tablets".</summary>
    [GeneratedRegex(@"^\s*(?:(\d+)\s+)?(\d+)\s*/\s*(\d+)\s*(.*)$")]
    private static partial Regex FractionPattern();

    /// <summary>
    /// Parses a dose amount.
    /// </summary>
    /// <param name="doseAmount">Text such as "½ tablet".</param>
    /// <param name="form">Medicine form, used to pick a unit when none is written.</param>
    /// <returns>Amount per dose (defaults to 1) and the singular unit.</returns>
    public static (decimal PerDose, string Unit) Parse(string? doseAmount, string? form = null)
    {
        var text = (doseAmount ?? "").Trim();
        var f = FractionPattern().Match(text);
        if (f.Success && decimal.Parse(f.Groups[3].Value) != 0)
        {
            var whole = f.Groups[1].Success ? decimal.Parse(f.Groups[1].Value) : 0;
            var value = whole + decimal.Parse(f.Groups[2].Value) / decimal.Parse(f.Groups[3].Value);
            var fu = Singular(f.Groups[4].Value);
            return (Math.Round(value, 3), fu.Length == 0 ? DefaultUnit(form) : fu);
        }

        var m = Pattern().Match(text);
        decimal amount = 0;
        if (m.Success)
        {
            if (m.Groups[1].Success)
                amount += decimal.Parse(m.Groups[1].Value.Replace(',', '.'), CultureInfo.InvariantCulture);
            if (m.Groups[2].Success)
                amount += Fractions[m.Groups[2].Value[0]];
            if (m.Groups[3].Success && m.Groups[4].Success && decimal.Parse(m.Groups[4].Value) != 0)
                amount += decimal.Parse(m.Groups[3].Value) / decimal.Parse(m.Groups[4].Value);
        }

        if (amount <= 0)
            amount = 1;
        var unit = Singular(m.Success ? m.Groups[5].Value : "");
        if (unit.Length == 0)
            unit = DefaultUnit(form);
        return (Math.Round(amount, 3), unit);
    }

    /// <summary>Default stock unit for a medicine form.</summary>
    public static string DefaultUnit(string? form) => (form ?? "").ToLowerInvariant() switch
    {
        "syrup" => "ml",
        "drops" => "drop",
        "inhaler" => "puff",
        "injection" => "unit",
        "powder" => "sachet",
        "pill" => "tablet",
        _ => "dose"
    };

    /// <summary>Normalizes "tablets" → "tablet", "puffs" → "puff"; keeps ml/g/mg.</summary>
    private static string Singular(string unit)
    {
        var u = unit.Trim().ToLowerInvariant();
        if (u is "ml" or "g" or "mg" or "mcg")
            return u;
        return u.EndsWith("es") && u is "patches" ? u[..^2] : u.EndsWith('s') ? u[..^1] : u;
    }

    /// <summary>Plural-aware label, e.g. Format(1.5m, "tablet") → "1.5 tablets".</summary>
    public static string Format(decimal qty, string unit)
    {
        var n = qty == Math.Floor(qty) ? qty.ToString("0", CultureInfo.InvariantCulture) : qty.ToString("0.##", CultureInfo.InvariantCulture);
        var plural = qty != 1 && unit is not ("ml" or "g" or "mg" or "mcg") && unit.Length > 0 ? unit + "s" : unit;
        return $"{n} {plural}".Trim();
    }
}
