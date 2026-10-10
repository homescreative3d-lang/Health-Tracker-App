import React from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Pill,
  User,
  X,
  Camera,
  FileImage,
  FileText,
  Paperclip,
  Download,
  Activity,
  CalendarClock,
} from "lucide-react";
import { type Medicine, type Patient, type PatientAttachment } from "../../api";
import { today, addDays, fmtTime } from "../../lib/dates";
import { err } from "../../lib/errors";
import { conditions, relationships } from "../../constants/options";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Row } from "../../components/DetailRow";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";
import { ConditionPicker } from "../../components/ConditionPicker";
import { Medicines } from "./Medicines";
import { Profile } from "./Profile";

export function PatientDetails({
  patient,
  meds,
  startEditing = false,
  onBack,
  onSave,
}: {
  patient: Patient;
  meds: Medicine[];
  startEditing?: boolean;
  onBack: () => void;
  onSave: (v: any) => Promise<boolean>;
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
  const set = (key: keyof Patient, value: any) => setDraft((v) => ({ ...v, [key]: value }));
  const initials = (draft.name || "?")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  const readFile = (file: File, callback: (dataUrl: string) => void, maxBytes: number) => {
    if (file.size > maxBytes) {
      setError(
        maxBytes <= 1024 * 1024
          ? "Profile photos must be 1 MB or smaller."
          : "Each attachment must be 10 MB or smaller.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => callback(String(reader.result));
    reader.onerror = () => setError("Unable to read this file. Please try another one.");
    reader.readAsDataURL(file);
  };
  const imageFile = (file: File, field: "profileImageUrl" | "doctorPhotoUrl") => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const mime =
      file.type ||
      (
        {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          heic: "image/heic",
          heif: "image/heif",
        } as Record<string, string>
      )[ext] ||
      "";
    if (!["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"].includes(mime)) {
      setError("Choose a JPEG, PNG or iPhone HEIC/HEIF image.");
      return;
    }
    readFile(
      file,
      (v) => set(field, v.startsWith("data:image/") ? v : v.replace(/^data:[^;,]*/, mime)),
      1024 * 1024,
    );
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setError("");
    const accepted: PatientAttachment[] = [];
    const picked = Array.from(files);
    let remaining = picked.length;
    picked.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const mime =
        file.type ||
        (
          {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            heic: "image/heic",
            heif: "image/heif",
            pdf: "application/pdf",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          } as Record<string, string>
        )[ext] ||
        "";
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/heic",
        "image/heif",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!allowed.includes(mime)) {
        setError(file.name + ": unsupported file type.");
        remaining--;
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(file.name + ": attachment must be 10 MB or smaller.");
        remaining--;
        return;
      }
      readFile(
        file,
        (dataUrl) => {
          accepted.push({ name: file.name, mimeType: mime, dataUrl });
          remaining--;
          if (remaining === 0)
            setDraft((v) => ({
              ...v,
              attachments: [...(v.attachments || []), ...accepted],
            }));
        },
        10 * 1024 * 1024,
      );
    });
  };
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
  const historyNodes = [
    ...(draft.conditions || []),
    ...(draft.medicalHistory || "")
      .split(/[\n;•]+/)
      .map((v) => v.trim())
      .filter(Boolean),
  ].filter((v, i, a) => a.indexOf(v) === i);
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
  const formatSize = (n?: number) =>
    n == null
      ? ""
      : n < 1024 * 1024
        ? Math.max(1, Math.round(n / 1024)) + " KB"
        : (n / 1024 / 1024).toFixed(1) + " MB";
  return (
    <div className="page-scroll patient-profile-view">
      <div className="page-head">
        <div>
          <span className="eyebrow">PATIENT INFORMATION</span>
          <h1>{draft.name || "Patient details"}</h1>
          <p className="muted">
            {editing
              ? "Update this patient’s information and care documents."
              : "Read-only overview of personal details, medical history and current medicines."}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn soft" onClick={onBack}>
            <ArrowLeft size={16} />
            Back
          </button>
          {!editing && (
            <button className="btn primary" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              Edit patient
            </button>
          )}
        </div>
      </div>
      <div className="patient-info-workspace">
        <nav className="patient-info-nav" aria-label="Patient information sections">
          <span className="patient-info-nav-label">PATIENT SECTIONS</span>
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
                    <span>{initials}</span>
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
                            if (f) imageFile(f, "profileImageUrl");
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
                            if (f) imageFile(f, "profileImageUrl");
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {draft.profileImageUrl && (
                        <button className="btn soft" onClick={() => set("profileImageUrl", "")}>
                          Remove photo
                        </button>
                      )}
                    </div>
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
                  <Field label="Doctor / prescriber photo">
                    <div className="photo-actions">
                      <label className="btn soft upload-btn">
                        <FileImage size={15} />
                        Gallery
                        <input
                          type="file"
                          accept="image/*,.heic,.heif"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) imageFile(f, "doctorPhotoUrl");
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
                            if (f) imageFile(f, "doctorPhotoUrl");
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {draft.doctorPhotoUrl && (
                        <button className="btn soft" onClick={() => set("doctorPhotoUrl", "")}>
                          Remove
                        </button>
                      )}
                    </div>
                  </Field>
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
                          addFiles(e.currentTarget.files);
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
                          addFiles(e.currentTarget.files);
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
