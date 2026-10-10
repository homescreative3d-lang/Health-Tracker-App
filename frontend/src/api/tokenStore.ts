/**
 * Access-token persistence.
 *
 * Isolated behind one module so the Android build (Capacitor) can swap `localStorage`
 * for secure storage without touching any screen code.
 */
const KEY = "access_token";

export const tokenStore = {
  /** Returns the stored JWT, or `null` when signed out. */
  get: (): string | null => localStorage.getItem(KEY),
  /** Persists a new JWT after sign-in. */
  set: (token: string): void => localStorage.setItem(KEY, token),
  /** Removes the JWT on sign-out or when the session is rejected. */
  clear: (): void => localStorage.removeItem(KEY),
};
