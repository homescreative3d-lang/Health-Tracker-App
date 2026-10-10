import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Patient, PatientInput } from "../../api";
import { today } from "../../lib/dates";
import { relationships } from "../../constants/options";
import { Avatar } from "../../components/Avatar";
import { ConditionPicker } from "../../components/ConditionPicker";
import { Field } from "../../components/Field";
import { ImagePickerButtons } from "../../components/ImagePickerButtons";
import { InlineError } from "../../components/InlineError";

type PatientScreenProps = {
  /** Patient being created (empty id) or completed during onboarding. */
  patient: Patient;
  /** "self" hides the relationship question and adjusts wording. */
  role: "self" | "caregiver";
  /** Cancels and returns to the hub. */
  onBack: () => void;
  /** Saves; resolves true on success (navigation is handled by the controller). */
  onSave: (v: PatientInput) => Promise<boolean>;
};

/** Patient setup form used for onboarding and for adding new patients. */
export function PatientScreen({ patient, role, onBack, onSave }: PatientScreenProps) {
  const [p, setP] = useState<Patient>({ ...patient, conditions: patient.conditions || [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSelf = role === "self";

  /** Updates one field of the draft. */
  const set = <K extends keyof Patient>(key: K, value: Patient[K]) =>
    setP((v) => ({ ...v, [key]: value }));

  /** Validates required fields and saves (busy state prevents duplicate patients). */
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const name = p.name.trim();
    if (name.length < 2) return setError("Enter a full name (at least 2 characters).");
    if (name.length > 100) return setError("Name must be 100 characters or fewer.");
    if (!isSelf && !p.relationship) return setError("Choose your relationship to the patient.");
    if (p.dob && p.dob > today()) return setError("Date of birth can't be in the future.");
    setBusy(true);
    try {
      await onSave({
        name,
        dob: p.dob || "",
        conditions: p.conditions,
        notes: (p.notes || "").trim(),
        relationship: isSelf ? "self" : p.relationship,
        mobile: p.mobile || "",
        doctor: p.doctor || "",
        medicalHistory: p.medicalHistory || "",
        profileImageUrl: p.profileImageUrl || "",
        doctorPhotoUrl: p.doctorPhotoUrl || "",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="setup-card card" onSubmit={submit} noValidate>
      <button
        type="button"
        className="icon-btn back"
        onClick={onBack}
        aria-label="Cancel and go back"
      >
        <ArrowLeft />
      </button>
      <span className="eyebrow">{patient.id ? "Step 2 of 2" : "New patient"}</span>
      <h2>{isSelf ? "A little about you" : "Tell us about the person you care for"}</h2>
      <p className="muted lead">
        These details label doses and reminders clearly for everyone helping.
      </p>

      {!isSelf && (
        <fieldset className="field">
          <legend className="field-label">
            Your relationship to them <em>required</em>
          </legend>
          <div className="chips">
            {relationships.map((r) => (
              <button
                type="button"
                className={p.relationship === r ? "chip selected" : "chip"}
                aria-pressed={p.relationship === r}
                key={r}
                onClick={() => set("relationship", r)}
              >
                {r}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="patient-photo-field">
        <Avatar name={p.name} src={p.profileImageUrl} size="xl" />
        <ImagePickerButtons
          label="patient photo"
          onPick={(v) => set("profileImageUrl", v)}
          onError={setError}
          onRemove={p.profileImageUrl ? () => set("profileImageUrl", "") : undefined}
        />
      </div>

      <div className="form-grid">
        <Field label={isSelf ? "Your full name" : "Their full name"} full>
          <input
            className="input"
            value={p.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Grace Whitfield"
            autoComplete={isSelf ? "name" : "off"}
            required
          />
        </Field>
        <Field label="Date of birth" hint="optional">
          <input
            className="input"
            type="date"
            max={today()}
            value={p.dob || ""}
            onChange={(e) => set("dob", e.target.value)}
          />
        </Field>
        <Field label="Mobile number" hint="optional">
          <input
            className="input"
            type="tel"
            inputMode="tel"
            value={p.mobile || ""}
            onChange={(e) => set("mobile", e.target.value)}
            placeholder="+91 98765 43210"
          />
        </Field>
        <Field label="Doctor or clinic" hint="optional" full>
          <input
            className="input"
            value={p.doctor || ""}
            onChange={(e) => set("doctor", e.target.value)}
            placeholder="Dr. Rao, City Clinic"
          />
        </Field>
        <div className="field full-field">
          <span className="field-label">Main conditions</span>
          <ConditionPicker selected={p.conditions} onChange={(c) => set("conditions", c)} />
        </div>
        <Field label="Medical history" hint="optional" full>
          <textarea
            className="input textarea"
            maxLength={1000}
            value={p.medicalHistory || ""}
            onChange={(e) => set("medicalHistory", e.target.value)}
            placeholder="One item per line, e.g. surgeries, allergies, past conditions"
          />
        </Field>
        <Field label="Notes for other caregivers" hint="optional" full>
          <textarea
            className="input textarea"
            maxLength={500}
            value={p.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Allergies, how they like to take medicines, anything worth knowing"
          />
        </Field>
        <div className="field full-field">
          <span className="field-label">
            Doctor or prescription photo <em>optional</em>
          </span>
          {p.doctorPhotoUrl && (
            <img
              className="doctor-photo-preview"
              src={p.doctorPhotoUrl}
              alt="Doctor or prescription"
            />
          )}
          <ImagePickerButtons
            label="doctor or prescription photo"
            onPick={(v) => set("doctorPhotoUrl", v)}
            onError={setError}
            onRemove={p.doctorPhotoUrl ? () => set("doctorPhotoUrl", "") : undefined}
          />
        </div>
      </div>

      {error && <InlineError>{error}</InlineError>}
      <button type="submit" className="btn primary full" disabled={busy}>
        {busy ? "Saving…" : "Save and continue"}
        {!busy && <ChevronRight size={18} aria-hidden="true" />}
      </button>
    </form>
  );
}
