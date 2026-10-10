import { tokenStore } from "./tokenStore";

/** API base URL; configure with `VITE_API_URL` (no trailing slash). */
export const API_BASE = (
  import.meta.env.VITE_API_URL || "https://health-tracker-app-3tzi.onrender.com/api"
).replace(/\/$/, "");

/** Error thrown for non-2xx responses, carrying the HTTP status for callers that need it. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Sends a JSON request to the API and parses the JSON response.
 * @param path - Path relative to `API_BASE`, e.g. `/doses`.
 * @param init - Fetch options (method, body...).
 * @param auth - When true (default), attaches the bearer token if one is stored.
 * @returns The parsed body, or `undefined` for 204 responses.
 * @throws ApiError with the server's `message`/`title`, or a network error message.
 */
export async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = tokenStore.get();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(API_BASE + path, { ...init, headers });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message || body.title || "Request failed", response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/**
 * Serializes a body for POST/PUT/DELETE requests.
 * @param method - HTTP verb.
 * @param body - Optional payload (JSON encoded).
 */
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});
