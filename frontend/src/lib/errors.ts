/**
 * Converts any thrown value into a user-facing message.
 * @param e - The caught value (usually an `Error` from the API client).
 * @returns The error's message, or a generic fallback.
 */
export function err(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
}
