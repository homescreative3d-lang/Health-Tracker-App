import { useState } from "react";
import { PauseCircle } from "lucide-react";
import type { Medicine } from "../../api";
import { dateLabel, today } from "../../lib/dates";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";
import { MedicineArt } from "../../components/art/MedicineArt";
import { confirmAction } from "../../components/ConfirmHost";

/** Common reasons offered as one-tap chips. */
const QUICK_REASONS = [
  "Doctor advised",
  "Side effects",
  "Out of stock",
  "Course finished",
  "Travelling",
];

type PauseDialogProps = {
  medicine: Medicine;
  /** First paused date (defaults to today). */
  startDate?: string;
  onClose: () => void;
  /** Performs the pause; resolves when done. */
  onPause: (id: string, start: string, reason: string) => Promise<void>;
};

/**
 * Pausing a medicine stops its doses and reminders, so it asks why (required, audited) and then
 * asks for a second confirmation before doing it.
 */
export function PauseDialog({ medicine, startDate, onClose, onPause }: PauseDialogProps) {
  const [start, setStart] = useState(startDate && startDate >= today() ? startDate : today());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /** Validates, double-confirms, then pauses. */
  const submit = async () => {
    if (reason.trim().length < 3)
      return setError("Tell us briefly why. It's saved in the change history.");
    const ok = await confirmAction({
      title: `Pause ${medicine.name}?`,
      message: `No doses or reminders from ${dateLabel(start)} until you resume it from Medicines. Reason: “${reason.trim()}”.`,
      confirmLabel: "Yes, pause it",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onPause(medicine.id, start, reason.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Pause ${medicine.name}`}
      icon={<MedicineArt form={medicine.form} size={40} />}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={submit}>
            <PauseCircle size={16} aria-hidden="true" />
            {busy ? "Pausing…" : "Continue"}
          </button>
        </>
      }
    >
      <Field label="Pause from">
        <input
          className="input"
          type="date"
          min={today()}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </Field>
      <div className="field">
        <span className="field-label">Why are you pausing it?</span>
        <div className="chips">
          {QUICK_REASONS.map((r) => (
            <button
              type="button"
              key={r}
              className={reason === r ? "chip selected" : "chip"}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          className="input textarea"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Or describe the reason"
          aria-label="Reason for pausing"
        />
      </div>
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}
