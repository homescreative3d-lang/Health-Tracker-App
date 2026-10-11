import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api, type AuditEntry, type Medicine } from "../../api";
import { err } from "../../lib/errors";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";

/** Human label for an audit action. */
export const ACTION_LABELS: Record<string, string> = {
  taken: "Taken",
  skipped: "Skipped",
  undone: "Undone",
  rescheduled: "Dose moved",
  paused: "Paused",
  resumed: "Resumed",
  created: "Added",
  updated: "Edited",
  deleted: "Removed",
  schedule_changed: "Schedule changed",
  refilled: "Refilled",
};

/** Audit list (shared by the medicine dialog and History → Changes). */
export function AuditList({
  entries,
  showPatient,
}: {
  entries: { entry: AuditEntry; patientName?: string }[];
  showPatient?: boolean;
}) {
  if (!entries.length) return <p className="muted">No changes recorded yet.</p>;
  return (
    <ol className="audit-list">
      {entries.map(({ entry: e, patientName }, i) => (
        <li
          key={e.id}
          className={`audit-item act-${e.action}`}
          style={{ ["--i" as string]: Math.min(i, 12) }}
        >
          <span className="audit-dot" aria-hidden="true" />
          <div className="audit-copy">
            <div className="audit-head">
              <span className="audit-tag">{ACTION_LABELS[e.action] || e.action}</span>
              <time>
                {new Date(e.at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <b>{e.summary}</b>
            <small>
              by {e.actorName}
              {showPatient && patientName ? ` · for ${patientName}` : ""}
            </small>
            {e.reason && <q>{e.reason}</q>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Change history of one medicine across all its rescheduled versions. */
export function MedicineHistoryDialog({
  medicine,
  onClose,
}: {
  medicine: Medicine;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .medicineHistory(medicine.id)
      .then(setRows)
      .catch((e) => {
        setError(err(e));
        setRows([]);
      });
  }, [medicine.id]);
  return (
    <Modal
      title={`${medicine.name}: change history`}
      icon={<History size={20} />}
      onClose={onClose}
      className="history-modal"
    >
      {error && <InlineError>{error}</InlineError>}
      {rows === null ? (
        <div className="preview-loading" role="status">
          Loading changes…
        </div>
      ) : (
        <AuditList entries={rows.map((entry) => ({ entry }))} />
      )}
    </Modal>
  );
}
