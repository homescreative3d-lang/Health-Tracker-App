import type { Notification } from "../api";

/**
 * Safely parses a notification's `dataJson` payload.
 * @param notification - Notification returned by the API.
 * @returns The parsed object, or `{}` when the payload is missing or malformed.
 */
export function parseNotificationData(notification: Notification): Record<string, any> {
  try {
    const value = JSON.parse(notification.dataJson || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

/** Human-readable labels for notification `type` codes emitted by the API. */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  refill_low: "Low medicine supply",
  dose_reminder: "Upcoming dose",
  dose_final: "Dose due now",
  dose_missed: "Missed dose",
  notification_failed: "Delivery issue",
  family_invite: "Family invitation",
};
