import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Closes a popover/dialog when the user presses Escape or clicks outside it.
 * @param ref - Element that counts as "inside".
 * @param onDismiss - Called once per dismiss gesture.
 * @param enabled - Set false to temporarily disable listeners.
 */
export function useDismiss(
  ref: RefObject<HTMLElement>,
  onDismiss: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("keydown", onKey);
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = window.setTimeout(() => document.addEventListener("pointerdown", onPointer), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [ref, onDismiss, enabled]);
}
