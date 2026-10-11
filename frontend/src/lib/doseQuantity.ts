/**
 * Mirrors the server's DoseQuantity parser: "½ tablet" → { perDose: 0.5, unit: "tablet" }.
 * Used to show stock in the right unit and convert between quantity and doses in forms.
 */
const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅔": 2 / 3,
  "⅛": 0.125,
};
const FORM_UNITS: Record<string, string> = {
  syrup: "ml",
  drops: "drop",
  inhaler: "puff",
  injection: "unit",
  powder: "sachet",
  pill: "tablet",
};

/** Singular unit ("tablets" → "tablet"); ml/g/mg unchanged. */
function singular(u: string): string {
  const v = u.trim().toLowerCase();
  if (["ml", "g", "mg", "mcg"].includes(v)) return v;
  return v.endsWith("s") ? v.slice(0, -1) : v;
}

/**
 * Parses a dose amount.
 * @param text - e.g. "1½ tablets", "5 ml", "1/4 tablet".
 * @param form - Medicine form for a default unit.
 */
export function parseDose(
  text: string | undefined,
  form?: string,
): { perDose: number; unit: string } {
  const t = (text || "").trim();
  const frac = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*(.*)$/.exec(t);
  let amount = 0;
  let rest = "";
  if (frac && Number(frac[3])) {
    amount = Number(frac[1] || 0) + Number(frac[2]) / Number(frac[3]);
    rest = frac[4];
  } else {
    const m = /^(\d+(?:[.,]\d+)?)?\s*([½⅓¼¾⅔⅛])?\s*(.*)$/.exec(t);
    if (m) {
      if (m[1]) amount += Number(m[1].replace(",", "."));
      if (m[2]) amount += FRACTIONS[m[2]];
      rest = m[3];
    }
  }
  const unit = singular(rest) || FORM_UNITS[(form || "").toLowerCase()] || "dose";
  return { perDose: amount > 0 ? Math.round(amount * 1000) / 1000 : 1, unit };
}

/**
 * Formats a quantity with a plural-aware unit: (1.5, "tablet") → "1.5 tablets".
 * @param qty - Quantity.
 * @param unit - Singular unit.
 */
export function formatQty(qty: number | undefined, unit: string | undefined): string {
  const q = Math.round((qty || 0) * 100) / 100;
  const u = unit || "";
  const plural = q !== 1 && u && !["ml", "g", "mg", "mcg"].includes(u) ? u + "s" : u;
  return `${q} ${plural}`.trim();
}
