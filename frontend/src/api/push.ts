import { api } from "./endpoints";

/**
 * Requests notification permission, registers the service worker and subscribes this
 * browser to Web Push, then stores the subscription on the API.
 * @param vapidPublicKey - The server VAPID public key (base64url).
 * @throws Error with a user-facing explanation for each failure mode.
 */
export async function enablePush(vapidPublicKey: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    throw new Error("Push notifications are not supported by this browser.");
  if (!window.isSecureContext)
    throw new Error(
      "Browser notifications require HTTPS (localhost is supported for development).",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked in browser settings. Allow notifications for this site and try again."
        : "Notification permission was not granted.",
    );
  await navigator.serviceWorker.register("/sw.js");
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active)
    throw new Error(
      "The notification service worker is not active yet. Refresh the page and try again.",
    );
  let sub = await reg.pushManager.getSubscription();
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
  return true;
}
/** Decodes a base64url string into bytes (required by PushManager.subscribe). */
function base64ToBytes(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
