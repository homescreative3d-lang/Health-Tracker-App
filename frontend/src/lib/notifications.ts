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
  dose_rescheduled: "Dose rescheduled",
  schedule_changed: "Schedule changed",
  family_invite_response: "Invitation answered",
  family_invite_cancelled: "Invitation withdrawn",
  family_member_joined: "New family member",
  family_member_removed: "Family member removed",
  family_member_left: "Family member left",
  family_role_changed: "Family role changed",
  family_updated: "Family updated",
  test_notification: "Test notification",
};

/**
 * Screen (hash route) to open for a notification type; mirrors the service worker's routes.
 * @param type - Notification type code.
 */
export function routeFor(type: string): string {
  if (type.startsWith("family_")) return "/#/family";
  if (type === "refill_low" || type === "schedule_changed") return "/#/medicines";
  if (type === "test_notification" || type === "notification_failed") return "/#/notifications";
  return "/#/today";
}
