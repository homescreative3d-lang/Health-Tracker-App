import { useState } from "react";
import { Bell, Package, Users } from "lucide-react";
import type { Notification, Patient } from "../../api";
import { NOTIFICATION_TYPE_LABELS, parseNotificationData } from "../../lib/notifications";
import { Modal } from "../../components/Modal";

type NotificationDetailModalProps = {
  notification: Notification;
  patients: Patient[];
  onClose: () => void;
  /** Opens Family management. */
  onOpenFamily: () => void;
  /** Accepts/declines a family invitation; resolves true on success. */
  onRespond: (n: Notification, accept: boolean) => Promise<boolean>;
};

/** Full details for one notification, with a next step where one exists. */
export function NotificationDetailModal({
  notification,
  patients,
  onClose,
  onOpenFamily,
  onRespond,
}: NotificationDetailModalProps) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  /** Answers the invitation and closes on success. */
  const answer = async (accept: boolean) => {
    setBusy(accept ? "yes" : "no");
    const ok = await onRespond(notification, accept);
    setBusy(null);
    if (ok) onClose();
  };
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
  // Unanswered invitations can be accepted or declined right here.
  const isInvite = notification.type === "family_invite" && !notification.isRead;

  return (
    <Modal
      title={notification.title}
      icon={<Bell size={20} />}
      onClose={onClose}
      actions={
        isInvite ? (
          <>
            <button className="btn soft" disabled={!!busy} onClick={() => answer(false)}>
              {busy === "no" ? "Declining…" : "Decline"}
            </button>
            <button className="btn primary" disabled={!!busy} onClick={() => answer(true)}>
              <Users size={16} aria-hidden="true" />
              {busy === "yes" ? "Joining…" : "Accept and join"}
            </button>
          </>
        ) : notification.type.startsWith("family_") ? (
          <>
            <button className="btn soft" onClick={onClose}>
              Close
            </button>
            <button className="btn primary" onClick={onOpenFamily}>
              <Users size={16} aria-hidden="true" />
              Open family
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
      {isInvite && (
        <div className="notice success">
          <Users size={18} aria-hidden="true" />
          <p>
            Accepting lets you see and help manage this family's patients. The person who invited
            you and the family admin will be told your answer.
          </p>
        </div>
      )}
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
