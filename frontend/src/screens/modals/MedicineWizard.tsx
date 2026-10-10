import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { Medicine, MedicineInput } from "../../api";
import { DAY_PARTS, fmtTime, part, today } from "../../lib/dates";
import { conditions, days, forms, frequencyLabel, liquids } from "../../constants/options";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";
import { TimePicker } from "../../components/TimePicker";
import { MedicineArt } from "../../components/art/MedicineArt";

type MedicineWizardProps = {
  /** Starting values (blank for new medicines, the medicine itself when editing). */
  initial: Medicine | MedicineInput;
  /** True when editing an existing medicine. */
  isEdit: boolean;
  /** Patient the medicine belongs to (shown for context). */
  patientName?: string;
  onClose: () => void;
  /** Saves; the controller closes the wizard on success. */
  onSave: (m: MedicineInput) => Promise<void>;
};

const STEPS = ["Details", "Schedule", "Supply"] as const;

/**
 * Live preview of which pill-organizer compartments the chosen dose times fall into,
 * so users see how the medicine will appear on the Today screen.
 */
function CompartmentPreview({ times }: { times: string[] }) {
  return (
    <div className="compartment-preview full-field" aria-label="Where these doses appear on Today">
      {DAY_PARTS.map((p) => {
        const hits = times.filter((t) => part(t) === p);
        return (
          <div
            key={p}
            className={`compartment part-${p.toLowerCase()}${hits.length ? " filled" : ""}`}
          >
            <span className="compartment-name">{p}</span>
            {hits.length ? hits.map((t) => <b key={t}>{fmtTime(t)}</b>) : <small>—</small>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Three-step add/edit medicine dialog: details → schedule → supply & review.
 * Each step validates before continuing; Save is disabled while the request runs so a
 * double click can't create two medicines.
 */
export function MedicineWizard({
  initial,
  isEdit,
  patientName,
  onClose,
  onSave,
}: MedicineWizardProps) {
  const { id: _id, ...start } = initial as Medicine;
  const [m, setM] = useState<MedicineInput>({ ...(start as MedicineInput) });
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Updates one field of the draft. */
  const set = <K extends keyof MedicineInput>(k: K, v: MedicineInput[K]) =>
    setM((x) => ({ ...x, [k]: v }));

  /** Returns the first validation problem for the current step (and earlier steps), or "". */
  const validate = (): string => {
    if (!m.name.trim()) return "Enter the medicine name.";
    if (m.name.trim().length > 100) return "Medicine name must be 100 characters or fewer.";
    if (!m.strength.trim()) return "Enter the strength, e.g. 500 mg.";
    if (!m.condition) return "Choose what this medicine is for.";
    if (step >= 1) {
      if (!m.times.length) return "Add at least one dose time.";
      if (m.frequencyPattern === "specificDays" && !m.specificDays.length)
        return "Choose at least one day.";
      if (
        m.frequencyPattern === "recurringCycle" &&
        (!Number.isInteger(m.cycleEvery) || m.cycleEvery < 1)
      )
        return "Repeat interval must be a whole number of at least 1.";
      if (!m.startDate) return "Choose a start date.";
    }
    if (step >= 2) {
      if (!Number.isInteger(m.supplyCount) || m.supplyCount < 1)
        return "Supply must be at least 1 dose.";
      if (m.isRecurring && (!Number.isInteger(m.refillThreshold) || m.refillThreshold < 0))
        return "Refill reminder can't be negative.";
    }
    return "";
  };

  /** Moves to the next step when the current one is valid. */
  const next = () => {
    const e = validate();
    setError(e);
    if (!e) setStep(step + 1);
  };

  /** Validates everything and saves. */
  const save = async () => {
    const e = validate();
    setError(e);
    if (e) return;
    setSaving(true);
    try {
      await onSave({
        ...m,
        name: m.name.trim(),
        strength: m.strength.trim(),
        refillThreshold: m.isRecurring ? m.refillThreshold : 0,
        times: [...new Set(m.times.map((x) => x.trim()).filter(Boolean))].sort(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `Edit ${initial.name || "medicine"}` : "Add a medicine"}
      kicker={patientName ? `For ${patientName}` : undefined}
      icon={<MedicineArt form={m.form} size={40} />}
      onClose={onClose}
      closeOnBackdrop={false}
      className="medicine-modal"
      actions={
        <>
          {step > 0 ? (
            <button
              className="btn soft"
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              Back
            </button>
          ) : (
            <button className="btn soft" onClick={onClose}>
              Cancel
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn primary" onClick={next}>
              Continue
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add medicine"}
              {!saving && <Check size={17} aria-hidden="true" />}
            </button>
          )}
        </>
      }
    >
      <ol className="progress-steps" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={i < step ? "done" : i === step ? "current" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="form-grid step-panel" key="s0">
          <Field label="Medicine name">
            <input
              className="input"
              value={m.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Metformin"
            />
          </Field>
          <Field label="Strength">
            <input
              className="input"
              value={m.strength}
              onChange={(e) => set("strength", e.target.value)}
              placeholder="e.g. 500 mg"
            />
          </Field>
          <Field label="Form">
            <select className="input" value={m.form} onChange={(e) => set("form", e.target.value)}>
              {forms.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Used for">
            <select
              className="input"
              value={m.condition}
              onChange={(e) => set("condition", e.target.value)}
            >
              <option value="">Choose a condition</option>
              {(conditions.includes(m.condition) || !m.condition
                ? conditions
                : [m.condition, ...conditions]
              ).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="form-grid step-panel" key="s1">
          <Field label="How often">
            <select
              className="input"
              value={m.frequencyPattern}
              onChange={(e) => set("frequencyPattern", e.target.value)}
            >
              <option value="daily">Every day</option>
              <option value="everyOtherDay">Every other day</option>
              <option value="specificDays">Specific days</option>
              <option value="recurringCycle">Every few days/weeks</option>
            </select>
          </Field>
          <Field label="Start date">
            <input
              className="input"
              type="date"
              min={isEdit ? undefined : today()}
              value={m.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>
          {m.frequencyPattern === "specificDays" && (
            <fieldset className="field full-field">
              <legend className="field-label">Days</legend>
              <div className="chips">
                {days.map((x) => (
                  <button
                    type="button"
                    aria-pressed={m.specificDays.includes(x)}
                    className={m.specificDays.includes(x) ? "chip selected" : "chip"}
                    key={x}
                    onClick={() =>
                      set(
                        "specificDays",
                        m.specificDays.includes(x)
                          ? m.specificDays.filter((v) => v !== x)
                          : [...m.specificDays, x],
                      )
                    }
                  >
                    {x}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {m.frequencyPattern === "recurringCycle" && (
            <>
              <Field label="Repeat every">
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={m.cycleEvery}
                  onChange={(e) => set("cycleEvery", Number(e.target.value))}
                />
              </Field>
              <Field label="Unit">
                <select
                  className="input"
                  value={m.cycleUnit}
                  onChange={(e) => set("cycleUnit", e.target.value)}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </Field>
            </>
          )}
          <div className="field full-field">
            <span className="field-label">Dose times</span>
            <TimePicker times={m.times} onChange={(times) => set("times", times)} />
          </div>
          <CompartmentPreview times={m.times} />
          <label className="check-row full-field">
            <input
              type="checkbox"
              checked={m.withFood}
              onChange={(e) => set("withFood", e.target.checked)}
            />
            Take with food
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid step-panel" key="s2">
          <label className="check-row full-field">
            <input
              type="checkbox"
              checked={m.isRecurring}
              onChange={(e) => set("isRecurring", e.target.checked)}
            />
            Ongoing medicine (repeats on the schedule)
          </label>
          <Field label="Doses in supply">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={m.supplyCount}
              onChange={(e) => set("supplyCount", Number(e.target.value))}
            />
          </Field>
          <Field label="Remind me to refill at">
            <input
              className="input"
              disabled={!m.isRecurring}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={m.isRecurring ? m.refillThreshold : 0}
              onChange={(e) => set("refillThreshold", Number(e.target.value))}
            />
          </Field>
          <Field label="Take with" full>
            <select
              className="input"
              value={m.liquid}
              onChange={(e) => set("liquid", e.target.value)}
            >
              {liquids.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <div className="review-box full-field">
            <b>Review</b>
            <span>
              {m.name || "Unnamed"} {m.strength} · {m.form}
            </span>
            <span>
              {frequencyLabel(m)} at {m.times.map(fmtTime).join(", ") || "no time set"}
            </span>
          </div>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}
