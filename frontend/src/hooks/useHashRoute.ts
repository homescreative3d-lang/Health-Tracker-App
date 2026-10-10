import { useCallback, useEffect, useState } from "react";

/**
 * Keeps the active hub tab in `location.hash` (e.g. `#/medicines`).
 *
 * This gives every screen a URL, makes the browser Back button move between tabs instead
 * of leaving the app, and lets the Android hardware back button (Capacitor maps it to
 * `history.back()`) behave the same way on the future mobile build.
 *
 * @param fallback - Tab shown when the hash is empty or unknown.
 * @param allowed - Valid tab ids.
 * @returns `[tab, setTab]`, where `setTab` pushes a history entry.
 */
export function useHashRoute<T extends string>(
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const read = useCallback((): T => {
    const value = window.location.hash.replace(/^#\/?/, "") as T;
    return allowed.includes(value) ? value : fallback;
  }, [allowed, fallback]);
  const [tab, setTabState] = useState<T>(read);

  useEffect(() => {
    const onChange = () => setTabState(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, [read]);

  const setTab = useCallback(
    (next: T) => {
      if (next === read()) return setTabState(next);
      window.location.hash = "/" + next;
      window.scrollTo({ top: 0 });
    },
    [read],
  );
  return [tab, setTab];
}
