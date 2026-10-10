import { Bell, ChevronRight, X } from "lucide-react";
import { type Medicine, type Patient, type Notification } from "../../api";
import { parseNotificationData } from "../../lib/notifications";

export function NotificationPopover({
  notifications,
  patients,
  onClose,
  onRead,
  onSelect,
}: {
  notifications: Notification[];
  patients: Patient[];
  onClose: () => void;
  onRead: (id: string) => Promise<void>;
  onSelect: (n: Notification) => void;
}) {
  const unread = notifications.filter((n) => !n.isRead).length;
  return (
    <div className="notification-popover" role="dialog" aria-label="Notifications">
      <div className="notification-popover-head">
        <div>
          <b>Notifications</b>
          <small>{unread ? unread + " unread" : "You're all caught up"}</small>
        </div>
        <button className="icon-btn" aria-label="Close notifications" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      {notifications.length ? (
        notifications.slice(0, 30).map((n) => {
          const data = parseNotificationData(n);
          const patientName =
            patients.find((p) => p.id === data.patientId)?.name || data.patientName;
          return (
            <div
              className={
                n.isRead ? "notification-popover-item" : "notification-popover-item unread"
              }
              key={n.id}
            >
              <button
                className="notification-open-btn"
                onClick={() => onSelect(n)}
                aria-label={"View details: " + n.title}
              >
                <span className="notification-copy">
                  <b>{n.title}</b>
                  {patientName && (
                    <strong className="notification-patient">Patient: {patientName}</strong>
                  )}
                  <span className="notification-message">{n.message}</span>
                  <small>{new Date(n.createdAt).toLocaleString()}</small>
                  <span className="notification-view-hint">
                    View details <ChevronRight size={14} />
                  </span>
                </span>
              </button>
              {!n.isRead && (
                <button
                  className="btn soft mark-read-btn"
                  onClick={async () => {
                    try {
                      await onRead(n.id);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          );
        })
      ) : (
        <div className="notification-empty">
          <Bell size={25} />
          <b>No notifications yet</b>
          <span>
            Medicine reminders, missed doses, refill alerts and family invitations will appear here.
          </span>
        </div>
      )}
    </div>
  );
}
