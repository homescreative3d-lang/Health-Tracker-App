/*
 * Tended service worker: receives Web Push and shows system notifications.
 * - Activates immediately (skipWaiting + clients.claim) so subscriptions never hit a
 *   "service worker not active" state after an update.
 * - Uses PNG icons: Android Chrome can't render SVG notification icons/badges.
 * - Dose notifications get Taken / Skip actions; every type opens the right screen.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Screen to open for each notification type (hash routes of the app). */
const ROUTES = {
  dose_reminder: "/#/today",
  dose_final: "/#/today",
  dose_missed: "/#/today",
  dose_rescheduled: "/#/today",
  schedule_changed: "/#/medicines",
  refill_low: "/#/medicines",
  family_invite: "/#/family",
  family_invite_response: "/#/family",
  family_member_joined: "/#/family",
  family_member_removed: "/#/family",
  family_member_left: "/#/family",
  family_role_changed: "/#/family",
  family_updated: "/#/family",
  family_invite_cancelled: "/#/today",
  test_notification: "/#/notifications",
};

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: "Tended", body: event.data?.text?.() || "" };
  }
  const actions = data.doseId
    ? [
        { action: "taken", title: "Taken" },
        { action: "skip", title: "Skip" },
      ]
    : [];
  const alarm = data.alertMode === "alarm" || data.alertMode === "both";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(
        alarm ? `⏰ ${data.title || "Tended"}` : data.title || "Tended",
        {
          body: data.body || "You have a new update.",
          icon: "/icon-192.png",
          badge: "/notification-badge.png",
          tag: data.doseId || data.type || "tended",
          renotify: true,
          // Alarm mode: strong, repeated vibration (Android) and stays until the user acts.
          vibrate: alarm ? [800, 300, 800, 300, 800, 300, 1200] : [200, 100, 200],
          requireInteraction: alarm || data.type === "dose_final" || data.type === "family_invite",
          silent: false,
          actions,
          data: {
            ...data,
            url: data.url && data.url !== "/" ? data.url : ROUTES[data.type] || "/",
          },
        },
      ),
      // If Tended is open, ask it to ring its in-app alarm (custom sound, loops until handled).
      alarm
        ? clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((list) =>
              list.forEach((c) =>
                c.postMessage({
                  type: "tended-alarm",
                  doseId: data.doseId,
                  alertMode: data.alertMode,
                }),
              ),
            )
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || "/", self.location.origin);
  if ((event.action === "taken" || event.action === "skip") && data.doseId) {
    url.searchParams.set("doseId", data.doseId);
    url.searchParams.set("doseAction", event.action);
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if ("focus" in client) {
          try {
            await client.navigate(url.href);
          } catch {}
          return client.focus();
        }
      }
      return clients.openWindow(url.href);
    }),
  );
});
