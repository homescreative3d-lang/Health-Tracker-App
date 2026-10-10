import { Bell } from "lucide-react";
import type { Notification } from "../../api";
import { EmptyArt } from "../../components/art/EmptyArt";

/** Notification types related to medication (family invites are shown on the Family page). */
const MEDICATION_TYPES = [
  "dose_reminder",
  "dose_final",
  "dose_missed",
  "notification_failed",
  "refill_low",
];

/** Recent medication notifications (last three days, newest first). */
export function NotificationInbox({ notifications }: { notifications: Notification[] }) {
  const items = notifications.filter((n) => MEDICATION_TYPES.includes(n.type));
  return (
    <section className="card notification-inbox">
      <div className="section-heading">
        <div>
          <h3>Recent medication alerts</h3>
          <p className="muted">From the last three days.</p>
        </div>
        <Bell aria-hidden="true" />
      </div>
      {items.length ? (
        <ul className="notification-items">
          {items.slice(0, 20).map((n) => (
            <li className={`notification-item type-${n.type}`} key={n.id}>
              <div>
                <b>{n.title}</b>
                <p>{n.message}</p>
              </div>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          No medication alerts yet. They appear here once reminders are scheduled.
        </p>
      )}
    </section>
  );
}
