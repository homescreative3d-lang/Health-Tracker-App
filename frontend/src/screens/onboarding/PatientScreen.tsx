import { useState } from "react";
import { ArrowLeft, ChevronRight, Camera, FileImage } from "lucide-react";
import { type Patient } from "../../api";
import { today } from "../../lib/dates";
import { conditions, relationships } from "../../constants/options";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { ConditionPicker } from "../../components/ConditionPicker";

export function PatientScreen({
  patient,
  role,
  onBack,
  onSave,
}: {
  patient: Patient;
  role: string;
  onBack: () => void;
  onSave: (v: {
    name: string;
    dob: string;
    conditions: string[];
    notes: string;
    relationship?: string;
    mobile?: string;
    doctor?: string;
    medicalHistory?: string;
    profileImageUrl?: string;
    doctorPhotoUrl?: string;
  }) => Promise<void>;
}) {
  const [p, setP] = useState({
      ...patient,
      conditions: patient.conditions || [],
    }),
    [error, setError] = useState("");
  const isSelf = role === "self";
  const submit = () => {
    setError("");
    if (!p.name.trim() || p.name.trim().length < 2)
      return setError("Please enter a valid full name.");
    if (p.name.trim().length > 100) return setError("Name must be 100 characters or fewer.");
    if (!isSelf && !p.relationship)
      return setError("Please choose your relationship to the patient.");
    if (p.dob && p.dob > today()) return setError("Date of birth cannot be in the future.");
    onSave({
      name: p.name.trim(),
      dob: p.dob || "",
      conditions: p.conditions,
      notes: p.notes.trim(),
      relationship: p.relationship,
      mobile: p.mobile || "",
      doctor: p.doctor || "",
      medicalHistory: p.medicalHistory || "",
      profileImageUrl: p.profileImageUrl || "",
      doctorPhotoUrl: p.doctorPhotoUrl || "",
    });
  };
  return (
    <section className="setup-card">
      <button className="icon-btn back" onClick={onBack}>
        <ArrowLeft />
      </button>
      <span className="eyebrow">STEP 1 · YOUR CARE PLAN</span>
      <h2>{isSelf ? "A little about you" : "Tell us about your patient"}</h2>
      <p className="muted lead">These details help TENDED label doses and reminders clearly.</p>
      {!isSelf && (
        <>
          <label className="field-label">
            Your relationship to the patient <em>required</em>
          </label>
          <div className="chips">
            {relationships.map((r) => (
              <button
                type="button"
                className={p.relationship === r ? "chip selected" : "chip"}
                key={r}
                onClick={() => setP({ ...p, relationship: r })}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="patient-photo-field">
        <div className="avatar patient-avatar-large">
          {p.profileImageUrl ? (
            <img src={p.profileImageUrl} alt="Patient" />
          ) : (
            (p.name || "?")
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")
          )}
        </div>
        <div className="photo-actions">
          <label className="btn soft upload-btn">
            <FileImage size={15} />
            Gallery
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 1024 * 1024) {
                  setError("Patient image must be 1 MB or smaller.");
                  return;
                }
                const ext = f.name.split(".").pop()?.toLowerCase() || "";
                const mime =
                  f.type ||
                  (
                    {
                      jpg: "image/jpeg",
                      jpeg: "image/jpeg",
                      png: "image/png",
                      heic: "image/heic",
                      heif: "image/heif",
                    } as Record<string, string>
                  )[ext] ||
                  "image/jpeg";
                const r = new FileReader();
                r.onload = () => {
                  let data = String(r.result);
                  if (!data.startsWith("data:image/")) data = data.replace(/^data:[^;,]*/, mime);
                  setP({ ...p, profileImageUrl: data });
                };
                r.readAsDataURL(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <label className="btn soft upload-btn">
            <Camera size={15} />
            Camera
            <input
              type="file"
              accept="image/*,.heic,.heif"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 1024 * 1024) {
                  setError("Patient image must be 1 MB or smaller.");
                  return;
                }
                const r = new FileReader();
                r.onload = () => setP({ ...p, profileImageUrl: String(r.result) });
                r.readAsDataURL(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <Field label={isSelf ? "Your full name" : "Patient's full name"}>
        <input
          className="input"
          value={p.name}
          onChange={(e) => setP({ ...p, name: e.target.value })}
          placeholder="e.g. Grace Whitfield"
        />
      </Field>
      <Field label="Date of birth">
        <input
          className="input"
          type="date"
          max={today()}
          value={p.dob || ""}
          onChange={(e) => setP({ ...p, dob: e.target.value })}
        />
      </Field>
      <Field label="Mobile number">
        <input
          className="input"
          value={p.mobile || ""}
          onChange={(e) => setP({ ...p, mobile: e.target.value })}
          placeholder="+91 98765 43210"
        />
      </Field>
      <Field label="Doctor">
        <input
          className="input"
          value={p.doctor || ""}
          onChange={(e) => setP({ ...p, doctor: e.target.value })}
          placeholder="Doctor name / clinic"
        />
      </Field>
      <Field label="Medical history">
        <textarea
          className="input textarea"
          maxLength={1000}
          value={p.medicalHistory || ""}
          onChange={(e) => setP({ ...p, medicalHistory: e.target.value })}
          placeholder="Relevant history"
        />
      </Field>
      <Field label="Doctor / prescriber photo">
        <div className="doctor-photo-upload">
          {p.doctorPhotoUrl && (
            <img
              className="doctor-photo-preview"
              src={p.doctorPhotoUrl}
              alt="Doctor or prescriber"
            />
          )}
          <div className="photo-actions">
            <label className="btn soft upload-btn">
              <FileImage size={16} />
              Gallery / computer
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024) return setError("Photo must be 1 MB or smaller.");
                  const reader = new FileReader();
                  reader.onload = () => setP({ ...p, doctorPhotoUrl: String(reader.result) });
                  reader.readAsDataURL(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label className="btn soft upload-btn">
              <Camera size={16} />
              Use camera
              <input
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1024 * 1024) return setError("Photo must be 1 MB or smaller.");
                  const reader = new FileReader();
                  reader.onload = () => setP({ ...p, doctorPhotoUrl: String(reader.result) });
                  reader.readAsDataURL(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {p.doctorPhotoUrl && (
              <button
                type="button"
                className="btn soft"
                onClick={() => setP({ ...p, doctorPhotoUrl: "" })}
              >
                Remove photo
              </button>
            )}
          </div>
          <small className="field-hint">
            Upload a prescription or doctor/prescriber photo. On mobile, Use camera opens the camera
            when supported.
          </small>
        </div>
      </Field>
      <Field label="Main conditions or diagnosis">
        <ConditionPicker
          selected={p.conditions}
          onChange={(conditions) => setP({ ...p, conditions })}
        />
      </Field>
      <Field label="Notes for other caregivers <span>optional</span>">
        <textarea
          className="input textarea"
          maxLength={500}
          value={p.notes}
          onChange={(e) => setP({ ...p, notes: e.target.value })}
          placeholder="Allergies, doctor's contact, anything worth knowing"
        />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <button className="btn primary full" onClick={submit}>
        Save and continue
        <ChevronRight size={18} />
      </button>
    </section>
  );
}
