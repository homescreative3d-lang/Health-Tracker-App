import { Bell, X, Package } from "lucide-react";
import { type Dose, type Medicine, type Patient, type Family, type Notification } from "../../api";
import { parseNotificationData } from "../../lib/notifications";

export function NotificationDetailModal({
  notification,
  patients,
  onClose,
}: {
  notification: Notification;
  patients: Patient[];
  onClose: () => void;
}) {
  const data = parseNotificationData(notification);
  const patient = patients.find((p) => p.id === data.patientId);
  const typeLabel: Record<string, string> = {
    refill_low: "Low medicine supply",
    dose_reminder: "Upcoming dose",
    dose_final: "Dose due now",
    dose_missed: "Missed dose",
    notification_failed: "Delivery issue",
    family_invite: "Family invitation",
  };
  const patientName = patient?.name || data.patientName || "Patient information unavailable";
  const medicineName = data.medicineName || "";
  const detailRows = [
    { label: "Patient", value: patientName },
    { label: "Medicine", value: medicineName || undefined },
    {
      label: "Doses remaining",
      value: data.dosesRemaining != null ? String(data.dosesRemaining) : undefined,
    },
    {
      label: "Refill threshold",
      value: data.refillThreshold != null ? String(data.refillThreshold) + " doses" : undefined,
    },
    {
      label: "Notification type",
      value: typeLabel[notification.type] || notification.type.replace(/_/g, " "),
    },
    {
      label: "Received",
      value: new Date(notification.createdAt).toLocaleString(),
    },
    { label: "Status", value: notification.isRead ? "Read" : "Unread" },
  ].filter((row) => row.value);
  return (
    <div
      className="modal-backdrop notification-detail-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="notification-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-detail-head">
          <div className="notification-detail-icon">
            <Bell size={21} />
          </div>
          <div>
            <span className="eyebrow">NOTIFICATION DETAILS</span>
            <h2 id="notification-detail-title">{notification.title}</h2>
          </div>
          <button className="icon-btn" aria-label="Close details" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p className="notification-detail-message">{notification.message}</p>
        <div className="notification-detail-rows">
          {detailRows.map((row) => (
            <div className="notification-detail-row" key={row.label}>
              <span>{row.label}</span>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
        {notification.type === "refill_low" && (
          <div className="notification-detail-tip">
            <Package size={17} />
            <span>Plan a refill soon to avoid missing scheduled doses.</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
