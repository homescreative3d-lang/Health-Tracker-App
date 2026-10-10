/**
 * Builds up-to-two-letter initials for avatar placeholders.
 * @param name - A person's display name.
 * @returns e.g. "Grace Whitfield" → "GW"; empty names → "?".
 */
export function initials(name?: string | null): string {
  const value = (name || "")
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return value || "?";
}

/**
 * Formats a byte count as KB/MB for attachment lists.
 * @param n - Size in bytes; `undefined` returns an empty string.
 */
export function formatSize(n?: number): string {
  if (n == null) return "";
  return n < 1024 * 1024
    ? Math.max(1, Math.round(n / 1024)) + " KB"
    : (n / 1024 / 1024).toFixed(1) + " MB";
}

/**
 * Returns "1 dose" / "3 doses" style labels.
 * @param count - Quantity.
 * @param singular - Singular noun.
 * @param pluralForm - Optional explicit plural (defaults to singular + "s").
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : pluralForm || singular + "s"}`;
}
