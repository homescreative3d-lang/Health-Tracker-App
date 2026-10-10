import { useRef } from "react";
import { Bell, CheckCheck, ChevronRight, X } from "lucide-react";
import type { Notification, Patient } from "../../api";
import { parseNotificationData } from "../../lib/notifications";
import { useDismiss } from "../../hooks/useDismiss";

type NotificationPopoverProps = {
  notifications: Notification[];
  patients: Patient[];
  onClose: () => void;
  onRead: (id: string) => Promise<void>;
  /** Marks every notification read (new). */
  onReadAll: () => Promise<void>;
  /** Opens the detail dialog for a notification. */
  onSelect: (n: Notification) => void;
};

/**
 * Notification panel anchored under the bell (full-width sheet on phones).
 * Closes on Escape or outside click.
 */
export function NotificationPopover({
  notifications,
  patients,
  onClose,
  onRead,
  onReadAll,
  onSelect,
}: NotificationPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose);
  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="notification-popover" role="dialog" aria-label="Notifications" ref={ref}>
      <div className="notification-popover-head">
        <div>
          <b>Notifications</b>
          <small>{unread ? `${unread} unread` : "You're all caught up"}</small>
        </div>
        {unread > 0 && (
          <button className="btn ghost sm" onClick={() => void onReadAll()}>
            <CheckCheck size={15} aria-hidden="true" />
            Mark all read
          </button>
        )}
        <button className="icon-btn" aria-label="Close notifications" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="notification-list">
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
                  aria-label={`${n.isRead ? "" : "Unread: "}${n.title}. View details`}
                >
                  <span className={`notification-type type-${n.type}`} aria-hidden="true" />
                  <span className="notification-copy">
                    <b>{n.title}</b>
                    {patientName && <strong className="notification-patient">{patientName}</strong>}
                    <span className="notification-message">{n.message}</span>
                    <small>{new Date(n.createdAt).toLocaleString()}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                {!n.isRead && (
                  <button className="btn ghost sm mark-read-btn" onClick={() => void onRead(n.id)}>
                    Mark read
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="notification-empty">
            <Bell size={24} aria-hidden="true" />
            <b>No notifications yet</b>
            <span>
              Dose reminders, missed doses, refill alerts and family invitations appear here.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
