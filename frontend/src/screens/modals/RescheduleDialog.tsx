import { useState } from "react";
import { ArrowRight, CalendarClock, Repeat } from "lucide-react";
import type { Dose, Medicine } from "../../api";
import { dateLabel, fmtTime, today } from "../../lib/dates";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";
import { TimePicker } from "../../components/TimePicker";
import { MedicineArt } from "../../components/art/MedicineArt";

type Mode = "dose" | "schedule";

type RescheduleDialogProps = {
  /** The dose being moved (absent when opened from a medicine card: schedule mode only). */
  dose?: Dose | null;
  /** The medicine (required for schedule mode). */
  medicine?: Medicine | null;
  onClose: () => void;
  /** Moves one dose; resolves true on success. */
  onRescheduleDose: (d: Dose, date: string, time: string) => Promise<boolean>;
  /** Changes the medicine's times from a date; resolves true on success. */
  onRescheduleMedicine: (m: Medicine, effectiveDate: string, times: string[]) => Promise<boolean>;
};

/**
 * Reschedule flow with two options:
 * - **Just this dose**: move one occurrence to another date/time. The original shows
 *   "Moved to …", the new one is badged "Rescheduled", and the care team is notified.
 * - **Whole schedule**: change the medicine's dose times from a date onwards; earlier history
 *   stays as it was and the medicine is marked "Rescheduled".
 * A before → after preview shows exactly what will change before confirming.
 */
export function RescheduleDialog({
  dose,
  medicine,
  onClose,
  onRescheduleDose,
  onRescheduleMedicine,
}: RescheduleDialogProps) {
  const [mode, setMode] = useState<Mode>(dose ? "dose" : "schedule");
  const [date, setDate] = useState(dose?.date && dose.date >= today() ? dose.date : today());
  const [time, setTime] = useState<string[]>([]); // no default time
  const [effective, setEffective] = useState(today());
  const [times, setTimes] = useState<string[]>(medicine?.times ? [...medicine.times] : []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const name = dose?.medName || medicine?.name || "Medicine";
  const form = dose?.form || medicine?.form || "Pill";

  /** Validates the active mode and submits it. */
  const submit = async () => {
    setError("");
    if (mode === "dose") {
      if (!dose) return;
      if (!date) return setError("Choose a date.");
      if (!time[0]) return setError("Choose the new time, then press Set time.");
      const target = new Date(`${date}T${time[0]}:00`);
      if (target.getTime() <= Date.now()) return setError("Choose a time later than now.");
      setBusy(true);
      const ok = await onRescheduleDose(dose, date, time[0]);
      setBusy(false);
      if (ok) onClose();
    } else {
      if (!medicine) return setError("This medicine couldn't be found. Refresh and try again.");
      if (!times.length) return setError("Add at least one dose time.");
      if (effective < today()) return setError("The new schedule can't start in the past.");
      const same = [...times].sort().join() === [...(medicine.times || [])].sort().join();
      if (same) return setError("Change at least one time to reschedule.");
      setBusy(true);
      const ok = await onRescheduleMedicine(medicine, effective, times);
      setBusy(false);
      if (ok) onClose();
    }
  };

  return (
    <Modal
      title={`Reschedule ${name}`}
      kicker={dose ? `${dose.patientName}` : undefined}
      icon={<MedicineArt form={form} size={40} />}
      onClose={onClose}
      className="reschedule-modal"
      actions={
        <>
          <button className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            <CalendarClock size={16} aria-hidden="true" />
            {busy ? "Rescheduling…" : mode === "dose" ? "Move this dose" : "Change schedule"}
          </button>
        </>
      }
    >
      {dose && (
        <div className="segmented resched-tabs" role="tablist" aria-label="What to reschedule">
          <button
            role="tab"
            aria-selected={mode === "dose"}
            className={mode === "dose" ? "selected" : ""}
            onClick={() => setMode("dose")}
          >
            <CalendarClock size={15} aria-hidden="true" /> Just this dose
          </button>
          <button
            role="tab"
            aria-selected={mode === "schedule"}
            className={mode === "schedule" ? "selected" : ""}
            onClick={() => setMode("schedule")}
            disabled={!medicine}
          >
            <Repeat size={15} aria-hidden="true" /> Whole schedule
          </button>
        </div>
      )}

      {mode === "dose" && dose && (
        <div className="resched-panel" key="dose">
          <div className="form-grid">
            <Field label="New date">
              <input
                className="input"
                type="date"
                min={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <div className="field full-field">
              <span className="field-label">New time</span>
              <TimePicker times={time} onChange={setTime} single />
            </div>
          </div>
          <div className="resched-preview" aria-live="polite">
            <div className="resched-slot from">
              <small>Now</small>
              <b>{dose.date ? dateLabel(dose.date) : "Scheduled"}</b>
              <span>{fmtTime(dose.time)}</span>
            </div>
            <ArrowRight className="resched-arrow" aria-hidden="true" />
            <div className={time[0] ? "resched-slot to ready" : "resched-slot to"}>
              <small>Moves to</small>
              <b>{date ? dateLabel(date) : "Pick a date"}</b>
              <span>{time[0] ? fmtTime(time[0]) : "Pick a time"}</span>
            </div>
          </div>
          <p className="field-hint">
            The original dose is marked “Moved”, the new one gets a “Rescheduled” badge and its own
            reminders, and everyone caring for {dose.patientName.split(" ")[0]} is notified.
          </p>
        </div>
      )}

      {mode === "schedule" && medicine && (
        <div className="resched-panel" key="schedule">
          <div className="form-grid">
            <Field label="New schedule starts">
              <input
                className="input"
                type="date"
                min={today()}
                value={effective}
                onChange={(e) => setEffective(e.target.value)}
              />
            </Field>
            <div className="field full-field">
              <span className="field-label">Dose times from then on</span>
              <TimePicker times={times} onChange={setTimes} />
            </div>
          </div>
          <div className="resched-preview">
            <div className="resched-slot from">
              <small>Until {dateLabel(effective)}</small>
              <b>{(medicine.times || []).map(fmtTime).join(", ") || "—"}</b>
            </div>
            <ArrowRight className="resched-arrow" aria-hidden="true" />
            <div className={times.length ? "resched-slot to ready" : "resched-slot to"}>
              <small>From {dateLabel(effective)}</small>
              <b>{times.length ? times.map(fmtTime).join(", ") : "Add a time"}</b>
            </div>
          </div>
          <p className="field-hint">
            Past doses and history stay as they were. Supply, frequency and other settings carry
            over, and the medicine is marked “Rescheduled”.
          </p>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}
