import { Bell } from "lucide-react";
import { type Notification } from "../../api";

export function NotificationInbox({ notifications }: { notifications: Notification[] }) {
  const items = notifications.filter((n) =>
    ["dose_reminder", "dose_final", "dose_missed", "notification_failed", "refill_low"].includes(
      n.type,
    ),
  );
  return (
    <div className="card notification-inbox">
      <div className="section-heading">
        <div>
          <span className="eyebrow">ATTENTION</span>
          <h3>Medication notifications</h3>
        </div>
        <Bell />
      </div>
      {items.length ? (
        items.slice(0, 20).map((n) => (
          <div className="notification-item" key={n.id}>
            <div>
              <b>{n.title}</b>
              <p>{n.message}</p>
            </div>
            <small>{new Date(n.createdAt).toLocaleString()}</small>
          </div>
        ))
      ) : (
        <p className="muted">
          No medication notifications yet. They will appear here when reminders are scheduled.
        </p>
      )}
    </div>
  );
}
