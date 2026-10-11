import { api } from "./endpoints";

/** True when this browser supports Web Push at all. */
export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/** Current notification permission ("unsupported" when the browser lacks the API). */
export const notificationPermission = (): NotificationPermission | "unsupported" =>
  pushSupported() ? Notification.permission : "unsupported";

/** Registers the service worker (idempotent) and waits until it is active. */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active)
    throw new Error(
      "The notification service worker isn't active yet. Refresh the page and try again.",
    );
  return reg;
}

/** Decodes a base64url string into bytes (required by PushManager.subscribe). */
function base64ToBytes(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** True when an existing subscription was made with a different server key. */
function keyChanged(sub: PushSubscription, vapidPublicKey: string): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = base64ToBytes(vapidPublicKey);
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

/**
 * Subscribes this browser and stores the subscription on the API. If the browser holds a
 * subscription made with older server keys (the usual cause of "push could not be delivered"),
 * it is replaced automatically.
 * @param vapidPublicKey - Server VAPID public key (base64url).
 */
async function subscribe(vapidPublicKey: string): Promise<void> {
  const reg = await readyRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && keyChanged(sub, vapidPublicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub)
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(vapidPublicKey),
    });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
    throw new Error("The browser returned an incomplete push subscription. Please try again.");
  await api.subscribePush({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

/**
 * Asks for notification permission, then subscribes this device to Web Push.
 * @param vapidPublicKey - The server VAPID public key.
 * @throws Error with a user-facing explanation for each failure mode.
 */
export async function enablePush(vapidPublicKey: string) {
  if (!pushSupported())
    throw new Error(
      "This browser doesn't support notifications. Try Chrome, Edge, Firefox or Safari 16.4+.",
    );
  if (!window.isSecureContext)
    throw new Error("Notifications need HTTPS (localhost works for development).");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in the browser's site settings (lock icon in the address bar), then try again."
        : "Notification permission wasn't granted.",
    );
  await subscribe(vapidPublicKey);
  return true;
}

/**
 * Silently keeps this device subscribed after sign-in when permission was already granted
 * (re-registers after key changes or expired subscriptions). Never prompts; errors are ignored.
 * @param vapidPublicKey - The server VAPID public key, if configured.
 */
export async function syncPush(vapidPublicKey?: string | null): Promise<void> {
  if (
    !vapidPublicKey ||
    !pushSupported() ||
    Notification.permission !== "granted" ||
    !window.isSecureContext
  )
    return;
  try {
    await subscribe(vapidPublicKey);
  } catch {
    /* best effort */
  }
}

/**
 * Shows a system notification from the page (used while the app is open in a background tab,
 * so alerts appear even if server push isn't configured). Requires granted permission.
 * @param title - Notification title.
 * @param body - Notification text.
 * @param tag - De-duplication tag (the notification id).
 * @param url - Screen to open when clicked.
 */
export async function showLocalNotification(title: string, body: string, tag: string, url: string) {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await readyRegistration();
    await reg.showNotification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/notification-badge.png",
      data: { url },
    });
  } catch {
    /* ignore */
  }
}
