import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";
import { type Dose, type Medicine } from "../../api";
import { today, fmtTime } from "../../lib/dates";
import { conditions, forms, days } from "../../constants/options";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { TimePicker } from "../../components/TimePicker";

export function MedicineWizard({
  initial,
  onClose,
  onSave,
}: {
  initial: Medicine | Omit<Medicine, "id">;
  onClose: () => void;
  onSave: (m: Omit<Medicine, "id">) => Promise<void>;
}) {
  const [m, setM] = useState<Omit<Medicine, "id">>({ ...initial } as Omit<Medicine, "id">),
    [step, setStep] = useState(0),
    [error, setError] = useState("");
  const set = (k: keyof Omit<Medicine, "id">, v: unknown) => setM((x) => ({ ...x, [k]: v }));
  const validate = () => {
    if (!m.name.trim()) return "Medicine name is required.";
    if (m.name.trim().length > 100) return "Medicine name must be 100 characters or fewer.";
    if (!m.strength.trim()) return "Enter the medicine strength.";
    if (!m.condition) return "Choose the condition this medicine is for.";
    if (step === 1) {
      if (!m.times.length) return "Add at least one dose time.";
      if (m.times.some((t) => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)))
        return "Use valid dose times such as 08:00 or 20:00.";
      if (m.frequencyPattern === "specificDays" && !m.specificDays.length)
        return "Choose at least one day.";
      if (
        m.frequencyPattern === "recurringCycle" &&
        (!Number.isInteger(m.cycleEvery) || m.cycleEvery < 1)
      )
        return "Enter a valid recurring cycle.";
      if (!m.startDate) return "Choose a start date.";
    }
    if (step === 2) {
      if (!m.isRecurring && m.supplyCount < 1) return "Supply is required and must be at least 1.";
      if (m.isRecurring && m.supplyCount < 1)
        return "Supply count is required and must be at least 1.";
      if (m.isRecurring && (!Number.isInteger(m.refillThreshold) || m.refillThreshold < 0))
        return "Refill threshold cannot be negative.";
    }
    return "";
  };
  const next = () => {
    const e = validate();
    if (e) return setError(e);
    setError("");
    setStep(step + 1);
  };
  const save = async () => {
    const e = validate();
    if (e) return setError(e);
    setError("");
    await onSave({
      ...m,
      name: m.name.trim(),
      strength: m.strength.trim(),
      times: m.times.map((x) => x.trim()).filter(Boolean),
    });
  };
  return (
    <div className="modal-backdrop">
      <div className="modal medicine-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">MEDICINE SETUP · {step + 1}/3</span>
            <h2>
              {step === 0 ? "Medicine details" : step === 1 ? "Schedule" : "Supply & reminders"}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="progress-steps">
          <i className={step >= 0 ? "done" : ""} />
          <i className={step >= 1 ? "done" : ""} />
          <i className={step >= 2 ? "done" : ""} />
        </div>
        {step === 0 && (
          <div className="form-grid">
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
              <select
                className="input"
                value={m.form}
                onChange={(e) => set("form", e.target.value)}
              >
                {forms.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Condition">
              <select
                className="input"
                value={m.condition}
                onChange={(e) => set("condition", e.target.value)}
              >
                <option value="">Select condition</option>
                {conditions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {step === 1 && (
          <div className="form-grid">
            <Field label="Frequency">
              <select
                className="input"
                value={m.frequencyPattern}
                onChange={(e) => set("frequencyPattern", e.target.value)}
              >
                <option value="daily">Every day</option>
                <option value="everyOtherDay">Every other day</option>
                <option value="specificDays">Specific days</option>
                <option value="recurringCycle">Recurring cycle</option>
              </select>
            </Field>
            {m.frequencyPattern === "specificDays" && (
              <div className="full-field">
                <label className="field-label">Days</label>
                <div className="chips">
                  {days.map((x) => (
                    <button
                      type="button"
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
              </div>
            )}
            {m.frequencyPattern === "recurringCycle" && (
              <>
                <Field label="Repeat every">
                  <input
                    className="input"
                    type="number"
                    min="1"
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
            <div className="full-field">
              <label className="field-label">Dose times</label>
              <TimePicker times={m.times} onChange={(times) => set("times", times)} />
            </div>
            <Field label="Start date">
              <input
                className="input"
                type="date"
                min={today()}
                value={m.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </Field>
            <label className="check-row">
              <input
                type="checkbox"
                checked={m.withFood}
                onChange={(e) => set("withFood", e.target.checked)}
              />{" "}
              Take with food
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="form-grid">
            <label className="check-row full-field">
              <input
                type="checkbox"
                checked={m.isRecurring}
                onChange={(e) => set("isRecurring", e.target.checked)}
              />{" "}
              Recurring medicine
            </label>
            <Field label="Supply count">
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                value={m.supplyCount}
                onChange={(e) => set("supplyCount", Number(e.target.value))}
              />
            </Field>
            <Field label="Refill reminder threshold">
              <input
                className="input"
                disabled={!m.isRecurring}
                type="number"
                min="0"
                step="1"
                value={m.isRecurring ? m.refillThreshold : 0}
                onChange={(e) => set("refillThreshold", Number(e.target.value))}
              />
            </Field>
            <Field label="Liquid">
              <select
                className="input"
                value={m.liquid}
                onChange={(e) => set("liquid", e.target.value)}
              >
                <option>No liquid needed</option>
                <option>Lukewarm water</option>
                <option>Milk</option>
                <option>Juice</option>
              </select>
            </Field>
            <div className="review-box">
              <b>Ready to save?</b>
              <span>
                {m.name} · {m.strength} · {m.times.map(fmtTime).join(", ")}
              </span>
            </div>
          </div>
        )}
        {error && <InlineError>{error}</InlineError>}
        <div className="modal-actions">
          {step > 0 && (
            <button
              className="btn soft"
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              Back
            </button>
          )}
          {step < 2 ? (
            <button className="btn primary" onClick={next}>
              Continue
              <ChevronRight size={17} />
            </button>
          ) : (
            <button className="btn primary" onClick={save}>
              Save medicine
              <Check size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
