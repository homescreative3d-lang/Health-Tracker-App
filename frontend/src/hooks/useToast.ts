import { useCallback, useRef, useState } from "react";

/** A transient status message. */
export type ToastMessage = { id: number; message: string; error?: boolean };

/**
 * Manages a single toast that auto-hides after a delay.
 * Errors stay visible longer so they can be read.
 * @returns The current toast, a `flash` function and a `dismiss` function.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number>();
  const dismiss = useCallback(() => setToast(null), []);
  const flash = useCallback((message: string, error = false) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, error });
    timer.current = window.setTimeout(() => setToast(null), error ? 6000 : 3200);
  }, []);
  return { toast, flash, dismiss };
}
