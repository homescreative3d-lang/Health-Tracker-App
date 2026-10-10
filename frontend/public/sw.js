self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {}
  const actions = data.doseId
    ? [
        { action: "taken", title: "Taken" },
        { action: "skip", title: "Skip" },
      ]
    : [];
  const form = (data.form || "pill").toLowerCase();
  const icons = {
    pill: "/medicine-pill.svg",
    injection: "/medicine-injection.svg",
    drops: "/medicine-drops.svg",
    syrup: "/medicine-drops.svg",
    inhaler: "/medicine-inhaler.svg",
    powder: "/medicine-powder.svg",
    other: "/medicine-other.svg",
  };
  event.waitUntil(
    self.registration.showNotification(data.title || "TENDED", {
      body: data.body || "You have a medication update.",
      icon: icons[form] || "/medicine-pill.svg",
      badge: "/tended-icon.svg",
      tag: data.doseId || data.type || "tended",
      renotify: true,
      silent: false,
      actions,
      data,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || "/", self.location.origin);
  if (event.action === "taken" || event.action === "skip") {
    if (data.doseId) {
      url.searchParams.set("doseId", data.doseId);
      url.searchParams.set("doseAction", event.action);
    }
  }
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      for (const client of list) {
        if ("focus" in client) {
          if (url.pathname !== "/" || url.search) {
            try {
              await client.navigate(url.href);
            } catch {}
          }
          return client.focus();
        }
      }
      return clients.openWindow(url.href);
    }),
  );
});
