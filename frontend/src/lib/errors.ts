export function err(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Please try again.";
}
