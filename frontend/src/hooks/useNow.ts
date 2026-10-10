import { useEffect, useState } from "react";

/**
 * Returns the current time, refreshed on an interval, so time-based UI (due-now highlight,
 * action windows) updates while the screen stays open.
 * @param intervalMs - Refresh period (default 30s).
 */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
