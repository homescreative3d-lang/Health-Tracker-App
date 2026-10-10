import { Bell, Package, Users } from "lucide-react";
import type { Notification, Patient } from "../../api";
import { NOTIFICATION_TYPE_LABELS, parseNotificationData } from "../../lib/notifications";
import { Modal } from "../../components/Modal";

type NotificationDetailModalProps = {
  notification: Notification;
  patients: Patient[];
  onClose: () => void;
  /** Opens Family management (family invitations are answered there). */
  onOpenFamily: () => void;
};

/** Full details for one notification, with a next step where one exists. */
export function NotificationDetailModal({
  notification,
  patients,
  onClose,
  onOpenFamily,
}: NotificationDetailModalProps) {
  const data = parseNotificationData(notification);
  const patient = patients.find((p) => p.id === data.patientId);
  const rows = [
    { label: "Patient", value: patient?.name || data.patientName },
    { label: "Medicine", value: data.medicineName },
    {
      label: "Doses remaining",
      value: data.dosesRemaining != null ? String(data.dosesRemaining) : undefined,
    },
    {
      label: "Refill threshold",
      value: data.refillThreshold != null ? `${data.refillThreshold} doses` : undefined,
    },
    {
      label: "Type",
      value: NOTIFICATION_TYPE_LABELS[notification.type] || notification.type.replace(/_/g, " "),
    },
    { label: "Received", value: new Date(notification.createdAt).toLocaleString() },
  ].filter((row) => row.value);
  const isInvite = notification.type === "family_invite";

  return (
    <Modal
      title={notification.title}
      icon={<Bell size={20} />}
      onClose={onClose}
      actions={
        isInvite ? (
          <>
            <button className="btn soft" onClick={onClose}>
              Later
            </button>
            <button className="btn primary" onClick={onOpenFamily}>
              <Users size={16} aria-hidden="true" />
              Review invitation
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        )
      }
    >
      <p className="notification-detail-message">{notification.message}</p>
      <dl className="notification-detail-rows">
        {rows.map((row) => (
          <div className="notification-detail-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {notification.type === "refill_low" && (
        <div className="notice warning">
          <Package size={18} aria-hidden="true" />
          <p>
            Plan a refill soon so scheduled doses aren't missed. Update the supply count after
            refilling.
          </p>
        </div>
      )}
    </Modal>
  );
}
