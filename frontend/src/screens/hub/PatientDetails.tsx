import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Camera,
  Download,
  FileImage,
  FileText,
  Paperclip,
  Pencil,
  Pill,
  User,
  X,
} from "lucide-react";
import type { Medicine, Patient, PatientAttachment, PatientInput } from "../../api";
import { addDays, fmtTime, today } from "../../lib/dates";
import { err } from "../../lib/errors";
import { readAttachmentFile } from "../../lib/files";
import { formatSize, initials as toInitials } from "../../lib/text";
import { relationships } from "../../constants/options";
import { ConditionPicker } from "../../components/ConditionPicker";
import { Field } from "../../components/Field";
import { ImagePickerButtons } from "../../components/ImagePickerButtons";
import { InlineError } from "../../components/InlineError";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";
import { PageHeader } from "../../components/PageHeader";
import { Row } from "../../components/DetailRow";
import { EmptyArt } from "../../components/art/EmptyArt";

/**
 * Patient workspace with four sections (personal details, medical history, attachments,
 * ongoing medicines). Opens read-only; "Edit patient" switches the sections to forms.
 * Attachments and photos are uploaded when the patient is saved.
 */
export function PatientDetails({
  patient,
  meds,
  startEditing = false,
  onBack,
  onSave,
  onAddPatient,
}: {
  patient: Patient;
  meds: Medicine[];
  startEditing?: boolean;
  onBack: () => void;
  onSave: (v: PatientInput) => Promise<boolean>;
  /** Shown when no patient exists yet. */
  onAddPatient: () => void;
}) {
  const [activeSection, setActiveSection] = useState<
      "personal" | "history" | "attachments" | "medicines"
    >("personal"),
    [editing, setEditing] = useState(startEditing),
    [draft, setDraft] = useState<Patient>({
      ...patient,
      conditions: patient.conditions || [],
      attachments: patient.attachments || [],
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft({
      ...patient,
      conditions: patient.conditions || [],
      attachments: patient.attachments || [],
    });
    setEditing(startEditing);
    setError("");
  }, [patient.id, patient.name, patient.attachments, startEditing]);
  /** Updates one draft field. */
  const set = (key: keyof Patient, value: any) => setDraft((v) => ({ ...v, [key]: value }));
  /**
   * Validates and adds picked attachments to the draft (they upload when the patient is saved).
   * @param files - Files from the attachment input.
   */
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const accepted: PatientAttachment[] = [];
    for (const file of Array.from(files)) {
      try {
        accepted.push(await readAttachmentFile(file));
      } catch (e) {
        setError(err(e));
      }
    }
    if (accepted.length)
      setDraft((v) => ({ ...v, attachments: [...(v.attachments || []), ...accepted] }));
  };
  /** Validates the draft and saves it through the controller. */
  const submit = async () => {
    setError("");
    if (!draft.name.trim() || draft.name.trim().length < 2) {
      setError("Enter a valid patient name.");
      return;
    }
    if (draft.dob && draft.dob > today()) {
      setError("Date of birth cannot be in the future.");
      return;
    }
    setBusy(true);
    try {
      const saved = await onSave({
        name: draft.name.trim(),
        dob: draft.dob || "",
        conditions: draft.conditions || [],
        notes: draft.notes || "",
        relationship: draft.relationship || "",
        mobile: draft.mobile || "",
        doctor: draft.doctor || "",
        medicalHistory: draft.medicalHistory || "",
        profileImageUrl: draft.profileImageUrl || "",
        doctorPhotoUrl: draft.doctorPhotoUrl || "",
        attachments: draft.attachments || [],
      });
      if (saved) setEditing(false);
      else setError("Changes could not be saved. Please check the error message and try again.");
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  };
  /** Conditions plus history lines, de-duplicated, for the history timeline. */
  const historyNodes = [
    ...(draft.conditions || []),
    ...(draft.medicalHistory || "")
      .split(/[\n;•]+/)
      .map((v) => v.trim())
      .filter(Boolean),
  ].filter((v, i, a) => a.indexOf(v) === i);
  /** One-line schedule summary for a medicine. */
  const schedule = (m: Medicine) =>
    m.times.map(fmtTime).join(" · ") +
    " · " +
    (m.frequencyPattern === "daily"
      ? "Daily"
      : m.frequencyPattern === "everyOtherDay"
        ? "Every other day"
        : m.frequencyPattern === "specificDays"
          ? (m.specificDays || []).join(", ")
          : "Every " + m.cycleEvery + " " + m.cycleUnit);
  /** Recurring medicines active today (started, not paused, not finished). */
  const ongoingMeds = meds.filter((m) => {
    if (!m.isRecurring || m.startDate > today()) return false;
    if (
      m.pauseStartDate &&
      m.pauseStartDate <= today() &&
      (!m.pauseEndDate || m.pauseEndDate >= today())
    )
      return false;
    if (m.durationType !== "ongoing") {
      const duration =
        m.durationUnit === "weeks"
          ? m.durationValue * 7
          : m.durationUnit === "months"
            ? m.durationValue * 30
            : m.durationValue;
      if (addDays(m.startDate, duration) <= today()) return false;
    }
    return true;
  });
  if (!patient.id)
    return (
      <div className="page-scroll">
        <PageHeader kicker="Patient information" title="No patient yet" />
        <div className="card empty-card">
          <EmptyArt kind="patient" />
          <b>Add a patient to see their details here</b>
          <button className="btn primary" onClick={onAddPatient}>
            Add patient
          </button>
        </div>
      </div>
    );

  return (
    <div className="page-scroll patient-profile-view">
      <PageHeader
        kicker="Patient information"
        title={draft.name || "Patient details"}
        description={
          editing
            ? "Update this patient's information and care documents."
            : "Personal details, medical history, documents and current medicines."
        }
        actions={
          <>
            <button className="btn soft" onClick={onBack}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </button>
            {!editing && (
              <button className="btn primary" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden="true" />
                Edit patient
              </button>
            )}
          </>
        }
      />
      <section className="patient-banner" aria-label="Patient summary">
        <span className="patient-banner-photo">
          {draft.profileImageUrl ? (
            <img src={draft.profileImageUrl} alt="" />
          ) : (
            toInitials(draft.name)
          )}
        </span>
        <div className="patient-banner-copy">
          <b>{draft.name || "Unnamed patient"}</b>
          <small>
            {draft.relationship === "self" ? "My health profile" : draft.relationship || "Patient"}
            {draft.dob ? ` · born ${draft.dob}` : ""}
          </small>
          {(draft.conditions || []).length > 0 && (
            <div className="patient-banner-tags">
              {(draft.conditions || []).slice(0, 4).map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="patient-banner-meds">
          <b>{ongoingMeds.length}</b>
          <small>ongoing medicine{ongoingMeds.length === 1 ? "" : "s"}</small>
        </div>
      </section>
      <div className="patient-info-workspace">
        <nav className="patient-info-nav" aria-label="Patient information sections">
          <span className="patient-info-nav-label">Sections</span>
          <button
            type="button"
            className={activeSection === "personal" ? "active" : ""}
            onClick={() => setActiveSection("personal")}
          >
            <User size={17} />
            <span>Personal details</span>
          </button>
          <button
            type="button"
            className={activeSection === "history" ? "active" : ""}
            onClick={() => setActiveSection("history")}
          >
            <Activity size={17} />
            <span>Medical history</span>
          </button>
          <button
            type="button"
            className={activeSection === "attachments" ? "active" : ""}
            onClick={() => setActiveSection("attachments")}
          >
            <Paperclip size={17} />
            <span>Attachments</span>
          </button>
          <button
            type="button"
            className={activeSection === "medicines" ? "active" : ""}
            onClick={() => setActiveSection("medicines")}
          >
            <Pill size={17} />
            <span>Ongoing medicines</span>
            <small>{ongoingMeds.length}</small>
          </button>
        </nav>
        <div className="patient-info-content">
          {activeSection === "personal" && (
            <section className="card patient-info-section">
              <div className="patient-info-section-head">
                <span className="patient-info-section-icon">
                  <User size={20} />
                </span>
                <div>
                  <h3>Personal details</h3>
                  <p className="muted">Basic information and caregiver relationship</p>
                </div>
              </div>
              <div className="patient-info-identity">
                <div className="patient-profile-photo">
                  {draft.profileImageUrl ? (
                    <img src={draft.profileImageUrl} alt={draft.name} />
                  ) : (
                    <span>{toInitials(draft.name)}</span>
                  )}
                </div>
                <div>
                  <b>{draft.name || "Unnamed patient"}</b>
                  <small>
                    {draft.relationship === "self"
                      ? "Own health profile"
                      : "Caregiver relationship · " + (draft.relationship || "Not specified")}
                  </small>
                  {editing && (
                    <ImagePickerButtons
                      label="patient photo"
                      onPick={(v) => set("profileImageUrl", v)}
                      onError={setError}
                      onRemove={
                        draft.profileImageUrl ? () => set("profileImageUrl", "") : undefined
                      }
                    />
                  )}
                </div>
              </div>
              {editing ? (
                <div className="patient-edit-grid">
                  <Field label="Full name">
                    <input
                      className="input"
                      value={draft.name || ""}
                      maxLength={100}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Date of birth">
                    <input
                      className="input"
                      type="date"
                      max={today()}
                      value={draft.dob || ""}
                      onChange={(e) => set("dob", e.target.value)}
                    />
                  </Field>
                  <Field label="Mobile number">
                    <input
                      className="input"
                      value={draft.mobile || ""}
                      onChange={(e) => set("mobile", e.target.value)}
                    />
                  </Field>
                  <Field label="Relationship to patient">
                    <select
                      className="input"
                      value={draft.relationship || ""}
                      onChange={(e) => set("relationship", e.target.value)}
                    >
                      <option value="">Choose relationship</option>
                      <option value="self">Self</option>
                      {relationships.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Doctor / clinic">
                    <input
                      className="input"
                      value={draft.doctor || ""}
                      onChange={(e) => set("doctor", e.target.value)}
                    />
                  </Field>
                  <Field label="Conditions or diagnosis">
                    <ConditionPicker
                      selected={draft.conditions || []}
                      onChange={(v) => set("conditions", v)}
                    />
                  </Field>
                  <Field label="Medical history">
                    <textarea
                      className="input textarea"
                      value={draft.medicalHistory || ""}
                      maxLength={4000}
                      onChange={(e) => set("medicalHistory", e.target.value)}
                      placeholder="Add a condition, event or important medical note on each line."
                    />
                  </Field>
                  <Field label="Care notes">
                    <textarea
                      className="input textarea"
                      value={draft.notes || ""}
                      maxLength={2000}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  </Field>
                  <div className="field full-field">
                    <span className="field-label">Doctor / prescriber photo</span>
                    {draft.doctorPhotoUrl && (
                      <img
                        className="doctor-photo-preview"
                        src={draft.doctorPhotoUrl}
                        alt="Doctor or prescriber"
                      />
                    )}
                    <ImagePickerButtons
                      label="doctor or prescription photo"
                      onPick={(v) => set("doctorPhotoUrl", v)}
                      onError={setError}
                      onRemove={draft.doctorPhotoUrl ? () => set("doctorPhotoUrl", "") : undefined}
                    />
                  </div>
                </div>
              ) : (
                <div className="patient-details-grid">
                  <Row label="Date of birth" value={draft.dob || "Not set"} />
                  <Row label="Mobile" value={draft.mobile || "Not set"} />
                  <Row
                    label="Relationship"
                    value={draft.relationship === "self" ? "Self" : draft.relationship || "Not set"}
                  />
                  <Row label="Doctor / clinic" value={draft.doctor || "Not set"} />
                  <Row
                    label="Conditions"
                    value={(draft.conditions || []).join(", ") || "Not set"}
                  />
                  <Row label="Care notes" value={draft.notes || "No notes added"} />
                </div>
              )}
            </section>
          )}
          {activeSection === "history" && (
            <section className="card patient-info-section">
              <div className="patient-info-section-head">
                <span className="patient-info-section-icon">
                  <Activity size={20} />
                </span>
                <div>
                  <h3>Medical history</h3>
                  <p className="muted">A visual timeline of recorded conditions and history</p>
                </div>
              </div>
              {historyNodes.length ? (
                <div className="medical-history-flow">
                  {historyNodes.map((node, i) => (
                    <div
                      className="medical-history-node"
                      key={node}
                      style={
                        {
                          animationDelay: i * 100 + "ms",
                        } as React.CSSProperties
                      }
                    >
                      <span className="medical-history-node-dot">{i + 1}</span>
                      <div>
                        <b>{node}</b>
                        <small>
                          {(draft.conditions || []).includes(node)
                            ? "Recorded condition"
                            : "Medical history note"}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-section-empty">
                  <Activity size={22} />
                  <b>No medical history added</b>
                  <span>Add conditions or history notes in edit mode to build this timeline.</span>
                </div>
              )}
              {!editing && draft.doctorPhotoUrl && (
                <div className="doctor-photo-detail">
                  <b>Doctor / prescriber photo</b>
                  <img src={draft.doctorPhotoUrl} alt="Doctor or prescriber" />
                </div>
              )}
            </section>
          )}
          {activeSection === "attachments" && (
            <section className="card patient-info-section">
              <div className="patient-info-section-head">
                <span className="patient-info-section-icon">
                  <Paperclip size={20} />
                </span>
                <div>
                  <h3>Attachments</h3>
                  <p className="muted">Medical documents, images, PDFs and spreadsheets</p>
                </div>
                {editing && (
                  <div className="attachment-add-actions">
                    <label className="btn soft upload-btn">
                      <FileImage size={15} />
                      Gallery / files
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.heic,.heif,.pdf,.xlsx,image/jpeg,image/png,image/heic,image/heif,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        hidden
                        onChange={(e) => {
                          void addFiles(e.currentTarget.files);
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
                          void addFiles(e.currentTarget.files);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {(draft.attachments || []).length ? (
                <div className="patient-attachments-list">
                  {(draft.attachments || []).map((a, i) => (
                    <div className="patient-attachment-row" key={a.key || a.dataUrl || a.name + i}>
                      <span className="attachment-file-icon">
                        {a.mimeType.startsWith("image/") ? (
                          <FileImage size={20} />
                        ) : (
                          <FileText size={20} />
                        )}
                      </span>
                      <div className="attachment-file-copy">
                        <b>{a.name}</b>
                        <small>
                          {a.mimeType.split("/").pop()?.toUpperCase()}{" "}
                          {a.size ? "· " + formatSize(a.size) : ""}
                        </small>
                      </div>
                      {a.url && (
                        <a
                          className="btn soft attachment-download"
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={15} />
                          Open
                        </a>
                      )}
                      {editing && (
                        <button
                          className="icon-btn"
                          aria-label={"Remove " + a.name}
                          onClick={() =>
                            set(
                              "attachments",
                              (draft.attachments || []).filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          <X size={17} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-section-empty">
                  <Paperclip size={22} />
                  <b>No attachments yet</b>
                  <span>Upload a prescription, report, medical image or XLSX file.</span>
                </div>
              )}
              <p className="field-hint">
                Supported: JPG/JPEG, PNG, iPhone HEIC/HEIF, PDF and XLSX. Maximum 10 MB per
                attachment.
              </p>
            </section>
          )}
          {activeSection === "medicines" && (
            <section className="card patient-info-section">
              <div className="patient-info-section-head">
                <span className="patient-info-section-icon">
                  <CalendarClock size={20} />
                </span>
                <div>
                  <h3>Ongoing medicines</h3>
                  <p className="muted">Active prescriptions and their schedules</p>
                </div>
                <span className="medicine-count-pill">{ongoingMeds.length}</span>
              </div>
              {ongoingMeds.length ? (
                <div className="ongoing-medicine-list">
                  {ongoingMeds.map((m) => (
                    <div className="ongoing-medicine-row" key={m.id}>
                      <span className="dose-icon">
                        <MedicineFormIcon form={m.form} />
                      </span>
                      <div className="ongoing-medicine-copy">
                        <b>
                          {m.name} {m.strength && <span>{m.strength}</span>}
                        </b>
                        <small>
                          {m.form}
                          {m.condition ? " · " + m.condition : ""}
                        </small>
                        <strong>{schedule(m)}</strong>
                        {m.withFood && <small>Take with food</small>}
                      </div>
                      <span
                        className={
                          m.supplyCount <= m.refillThreshold ? "status-danger" : "status-success"
                        }
                      >
                        {m.supplyCount} doses left
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="patient-section-empty">
                  <Pill size={22} />
                  <b>No ongoing medicines</b>
                  <span>
                    Medicines added to this patient’s plan will appear here with their schedule.
                  </span>
                </div>
              )}
            </section>
          )}
          {editing && (
            <div className="patient-edit-footer">
              {error && <InlineError>{error}</InlineError>}
              <div className="modal-actions">
                <button
                  className="btn soft"
                  disabled={busy}
                  onClick={() => {
                    setDraft({
                      ...patient,
                      conditions: patient.conditions || [],
                      attachments: patient.attachments || [],
                    });
                    setEditing(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>
                <button className="btn primary" disabled={busy} onClick={() => void submit()}>
                  {busy ? "Saving…" : "Save patient details"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
