import { type Notification } from "../api";

export function parseNotificationData(notification: Notification): Record<string, any> {
  try {
    const value = JSON.parse(notification.dataJson || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
