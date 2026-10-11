import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  ClipboardList,
  FilePlus2,
  FileText,
  FlaskConical,
  Pencil,
  Pill,
  Plus,
  ScanLine,
  Sparkles,
  Stethoscope,
  Syringe,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  api,
  type MedicalRecord,
  type MedicalRecordInput,
  type MedicalRecordType,
  type PrescriptionDraft,
  type RecordMedicine,
} from "../../api";
import { parseLocalDate, today } from "../../lib/dates";
import { err } from "../../lib/errors";
import { readAsDataUrl, detectMime } from "../../lib/files";
import { AttachmentPreview } from "../../components/AttachmentPreview";
import { CameraCapture } from "../../components/CameraCapture";
import { confirmAction } from "../../components/ConfirmHost";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";
import { EmptyArt } from "../../components/art/EmptyArt";

/** Display info per record type (label, icon, color tone). */
const TYPES: Record<MedicalRecordType, { label: string; icon: LucideIcon; tone: string }> = {
  prescription: { label: "Prescription", icon: Pill, tone: "teal" },
  diagnosis: { label: "Diagnosis", icon: Stethoscope, tone: "night" },
  procedure: { label: "Procedure", icon: Activity, tone: "evening" },
  allergy: { label: "Allergy", icon: AlertTriangle, tone: "danger" },
  lab: { label: "Lab result", icon: FlaskConical, tone: "afternoon" },
  vaccination: { label: "Vaccination", icon: Syringe, tone: "morning" },
  note: { label: "Note", icon: ClipboardList, tone: "muted" },
};

const SCAN_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif,.pdf";
const MAX_SCAN_BYTES = 10 * 1024 * 1024;

/** Empty editor values. */
const blankRecord = (type: MedicalRecordType = "note"): MedicalRecordInput => ({
  date: "",
  type,
  title: "",
  details: "",
  doctor: "",
  facility: "",
  medicines: [],
});

/** Formats a record date for the timeline ("12 Oct 2026"). */
const formatDate = (d: string | null) =>
  d
    ? parseLocalDate(d).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date unknown";

/** Turns a scanner draft into editor values the user reviews before saving. */
function draftToRecord(d: PrescriptionDraft): MedicalRecordInput {
  return {
    date: d.date || "",
    type: "prescription",
    title: d.diagnosis
      ? `Prescription: ${d.diagnosis}`
      : d.doctor
        ? `Prescription from ${d.doctor}`
        : "Prescription",
    details: [d.diagnosis && `Diagnosis: ${d.diagnosis}`, d.notes].filter(Boolean).join("\n"),
    doctor: d.doctor,
    facility: d.facility,
    medicines: d.medicines,
    aiExtracted: true,
  };
}

type MedicalTimelineProps = {
  patientId: string;
  patientName: string;
  /** Conditions and free-text history from the patient profile (shown as undated notes). */
  legacyNotes: { text: string; kind: "condition" | "note" }[];
};

/**
 * Medical history as an animated timeline grouped by year, with filters, manual entries and
 * prescription scanning. Scans return an editable draft; nothing is saved until confirmed.
 */
export function MedicalTimeline({ patientId, patientName, legacyNotes }: MedicalTimelineProps) {
  const [records, setRecords] = useState<MedicalRecord[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<MedicalRecordType | "all">("all");
  const [editor, setEditor] = useState<{
    record: MedicalRecord | null;
    values: MedicalRecordInput;
    source?: string;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState<MedicalRecord | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  /** Loads the patient's records. */
  const load = async () => {
    try {
      setRecords(await api.getMedicalRecords(patientId));
      setError("");
    } catch (e) {
      setError(err(e));
      setRecords([]);
    }
  };
  useEffect(() => {
    setRecords(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const visible = (records || []).filter((r) => filter === "all" || r.type === filter);
  const years = useMemo(() => {
    const groups: { year: string; items: MedicalRecord[] }[] = [];
    for (const r of visible) {
      const y = r.date ? r.date.slice(0, 4) : "Undated";
      const g = groups.find((x) => x.year === y);
      if (g) g.items.push(r);
      else groups.push({ year: y, items: [r] });
    }
    return groups;
  }, [visible]);
  const presentTypes = [...new Set((records || []).map((r) => r.type))];

  /** Called after save: reloads and highlights the new/edited entry. */
  const saved = async (r: MedicalRecord) => {
    setEditor(null);
    await load();
    setFresh(r.id);
    window.setTimeout(() => setFresh(null), 2400);
  };

  /** Deletes a record after confirmation. */
  const remove = async (r: MedicalRecord) => {
    const ok = await confirmAction({
      title: "Delete this history entry?",
      message: `“${r.title}” and any attached document will be permanently removed. This can't be undone.`,
      confirmLabel: "Delete entry",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.deleteMedicalRecord(patientId, r.id);
      await load();
    } catch (e) {
      setError(err(e));
    }
  };

  return (
    <div className="med-history">
      <div className="med-history-actions">
        <button type="button" className="btn primary" onClick={() => setScanning(true)}>
          <ScanLine size={17} aria-hidden="true" /> Scan prescription
        </button>
        <button
          type="button"
          className="btn soft"
          onClick={() => setEditor({ record: null, values: blankRecord() })}
        >
          <Plus size={17} aria-hidden="true" /> Add entry
        </button>
      </div>

      {presentTypes.length > 1 && (
        <div className="chips med-filter" role="radiogroup" aria-label="Filter history">
          {(["all", ...presentTypes] as const).map((t) => (
            <button
              type="button"
              key={t}
              role="radio"
              aria-checked={filter === t}
              className={filter === t ? "chip selected" : "chip"}
              onClick={() => setFilter(t)}
            >
              {t === "all" ? "All" : TYPES[t].label}
            </button>
          ))}
        </div>
      )}

      {error && <InlineError>{error}</InlineError>}
      {records === null && (
        <div className="preview-loading" role="status">
          Loading history…
        </div>
      )}

      {records !== null && records.length === 0 && legacyNotes.length === 0 && (
        <div className="empty-card compact">
          <EmptyArt kind="history" size={120} />
          <b>No medical history yet</b>
          <span className="muted">
            Scan a prescription or add an entry to start {patientName.split(" ")[0]}'s timeline.
          </span>
        </div>
      )}

      {years.length > 0 && (
        <ol className="med-timeline" aria-label="Medical history timeline">
          {years.map((g, gi) => (
            <li className="med-year" key={g.year} style={{ ["--g" as string]: gi }}>
              <span className="med-year-label">{g.year}</span>
              <ol>
                {g.items.map((r, i) => {
                  const t = TYPES[r.type] || TYPES.note;
                  const Icon = t.icon;
                  return (
                    <li
                      key={r.id}
                      className={`med-node tone-${t.tone}${fresh === r.id ? " is-fresh" : ""}`}
                      style={{ ["--i" as string]: gi * 3 + i }}
                    >
                      <span className="med-node-dot" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <article className="med-node-card">
                        <header>
                          <div>
                            <time>{formatDate(r.date)}</time>
                            <h4>{r.title}</h4>
                          </div>
                          <span className="med-type-tag">{t.label}</span>
                        </header>
                        {(r.doctor || r.facility) && (
                          <p className="med-node-who">
                            <Stethoscope size={13} aria-hidden="true" />
                            {[r.doctor, r.facility].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {r.details && <p className="med-node-details">{r.details}</p>}
                        {r.medicines.length > 0 && (
                          <ul className="med-node-meds">
                            {r.medicines.map((m, k) => (
                              <li key={k}>
                                <b>{m.name}</b>
                                <span>
                                  {[m.strength, m.dose, m.frequency, m.duration, m.instructions]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <footer>
                          {r.aiExtracted && (
                            <span
                              className="ai-tag"
                              title="Read from a scanned prescription and reviewed before saving"
                            >
                              <Sparkles size={12} aria-hidden="true" /> Scanned
                            </span>
                          )}
                          {r.sourceUrl && (
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => setPreview(r)}
                            >
                              <FileText size={14} aria-hidden="true" /> View document
                            </button>
                          )}
                          <span className="spacer" />
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Edit ${r.title}`}
                            onClick={() =>
                              setEditor({
                                record: r,
                                values: {
                                  date: r.date || "",
                                  type: r.type,
                                  title: r.title,
                                  details: r.details,
                                  doctor: r.doctor,
                                  facility: r.facility,
                                  medicines: r.medicines,
                                  aiExtracted: r.aiExtracted,
                                },
                              })
                            }
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label={`Delete ${r.title}`}
                            onClick={() => remove(r)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </footer>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {legacyNotes.length > 0 && filter === "all" && (
        <div className="med-legacy">
          <span className="med-year-label">From the profile</span>
          <ul>
            {legacyNotes.map((n) => (
              <li key={n.text} className={n.kind}>
                <span className="dot" aria-hidden="true" />
                <b>{n.text}</b>
                <small>{n.kind === "condition" ? "Condition" : "History note"}</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      {scanning && (
        <ScanPrescription
          patientId={patientId}
          onClose={() => setScanning(false)}
          onManual={() => {
            setScanning(false);
            setEditor({ record: null, values: blankRecord("prescription") });
          }}
          onDraft={(draft, source) => {
            setScanning(false);
            setEditor({ record: null, values: draftToRecord(draft), source });
          }}
        />
      )}
      {editor && (
        <RecordEditor
          patientId={patientId}
          record={editor.record}
          initial={editor.values}
          source={editor.source}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {preview?.sourceUrl && (
        <AttachmentPreview
          attachments={[
            {
              name: preview.title,
              mimeType: preview.sourceMimeType || "image/jpeg",
              url: preview.sourceUrl,
            },
          ]}
          start={0}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/**
 * Scan flow: choose camera or file → (data notice) → animated scanning → returns a draft.
 * Falls back to manual entry when scanning isn't configured or fails.
 */
function ScanPrescription({
  patientId,
  onClose,
  onDraft,
  onManual,
}: {
  patientId: string;
  onClose: () => void;
  onDraft: (d: PrescriptionDraft, source: string) => void;
  onManual: () => void;
}) {
  const [status, setStatus] = useState<{
    enabled: boolean;
    showDataNotice: boolean;
    provider: string;
  } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const deviceCamera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .medicalAiStatus()
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, showDataNotice: true, provider: "Google Gemini" }));
  }, []);

  const needsConsent = !!status?.showDataNotice && !agreed;

  /** Sends the image to the scanner and hands the draft back. */
  const scan = async (dataUrl: string) => {
    setImage(dataUrl);
    setError("");
    setBusy(true);
    try {
      const draft = await api.scanPrescription(patientId, dataUrl);
      if (!draft.isPrescription) {
        setError(
          "This doesn't look like a prescription or medical document. Try another photo, or enter the details by hand.",
        );
        return;
      }
      onDraft(draft, dataUrl);
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  };

  /** Validates a picked file and scans it. */
  const pick = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    if (f.size > MAX_SCAN_BYTES) return setError("The file must be 10 MB or smaller.");
    const data = await readAsDataUrl(f);
    const mime = detectMime(f) || "image/jpeg";
    void scan(
      data.startsWith("data:;") || data.startsWith("data:application/octet-stream")
        ? data.replace(/^data:[^;]*/, "data:" + mime)
        : data,
    );
  };

  return (
    <Modal
      title="Scan a prescription"
      icon={<ScanLine size={20} />}
      onClose={onClose}
      className="scan-modal"
      closeOnBackdrop={!busy}
      actions={
        <>
          <button type="button" className="btn ghost" onClick={onManual} disabled={busy}>
            <FilePlus2 size={16} aria-hidden="true" /> Enter by hand instead
          </button>
          <button type="button" className="btn soft" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </>
      }
    >
      {status && !status.enabled ? (
        <div className="notice warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            Prescription scanning isn't set up on the server yet (an admin needs to add a Gemini API
            key). You can still add the prescription by hand.
          </p>
        </div>
      ) : image ? (
        <div className={busy ? "scan-stage is-scanning" : "scan-stage"}>
          {image.startsWith("data:application/pdf") ? (
            <div className="scan-pdf">
              <FileText size={48} aria-hidden="true" /> PDF document
            </div>
          ) : (
            <img src={image} alt="Prescription being scanned" />
          )}
          {busy && (
            <>
              <span className="scan-line" aria-hidden="true" />
              <div className="scan-status" role="status">
                <Sparkles size={16} aria-hidden="true" /> Reading the prescription…
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="muted">
            Photograph or upload a prescription. We'll read the date, doctor, diagnosis and
            medicines. You review and edit everything before it's saved.
          </p>
          {status?.showDataNotice && (
            <label className="consent-box">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                The image is sent to {status.provider} to read it. With free API keys, Google may
                use submitted content to improve its services. Only scan documents you're
                comfortable sharing.
              </span>
            </label>
          )}
          <div className="scan-choices">
            <button
              type="button"
              className="scan-choice"
              disabled={!status || needsConsent}
              onClick={() => setCamera(true)}
            >
              <Camera size={26} aria-hidden="true" />
              <b>Take a photo</b>
              <small>Use the camera</small>
            </button>
            <button
              type="button"
              className="scan-choice"
              disabled={!status || needsConsent}
              onClick={() => file.current?.click()}
            >
              <Upload size={26} aria-hidden="true" />
              <b>Upload</b>
              <small>Photo or PDF, up to 10 MB</small>
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept={SCAN_ACCEPT}
            hidden
            onChange={(e) => void pick(e.currentTarget)}
          />
          <input
            ref={deviceCamera}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => void pick(e.currentTarget)}
          />
        </>
      )}
      {error && (
        <>
          <InlineError>{error}</InlineError>
          {image && !busy && (
            <button type="button" className="btn soft" onClick={() => setImage("")}>
              <X size={16} aria-hidden="true" /> Try another image
            </button>
          )}
        </>
      )}
      {camera && (
        <CameraCapture
          title="Photograph the prescription"
          onClose={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            deviceCamera.current?.click();
          }}
          onCapture={(d) => {
            setCamera(false);
            void scan(d);
          }}
        />
      )}
    </Modal>
  );
}

/** Add/edit form for a record; also the review step after a scan. */
function RecordEditor({
  patientId,
  record,
  initial,
  source,
  onClose,
  onSaved,
}: {
  patientId: string;
  record: MedicalRecord | null;
  initial: MedicalRecordInput;
  /** Scanned image to attach on save. */
  source?: string;
  onClose: () => void;
  onSaved: (r: MedicalRecord) => void;
}) {
  const [v, setV] = useState<MedicalRecordInput>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fromScan = !!initial.aiExtracted && !record;

  /** Updates one field. */
  const set = <K extends keyof MedicalRecordInput>(k: K, value: MedicalRecordInput[K]) =>
    setV((x) => ({ ...x, [k]: value }));
  /** Updates one medicine row. */
  const setMed = (i: number, patch: Partial<RecordMedicine>) =>
    set(
      "medicines",
      v.medicines.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    );

  /** Validates and saves (attaching the scanned image for new scanned records). */
  const save = async () => {
    setError("");
    if (v.title.trim().length < 2) return setError("Enter a title.");
    if (v.date && v.date > today()) return setError("The date can't be in the future.");
    setSaving(true);
    try {
      const body = {
        ...v,
        title: v.title.trim(),
        medicines: v.medicines.filter((m) => m.name.trim()),
        sourceDataUrl: source,
      };
      const r = record
        ? await api.updateMedicalRecord(patientId, record.id, body)
        : await api.createMedicalRecord(patientId, body);
      onSaved(r);
    } catch (e) {
      setError(err(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        record
          ? "Edit history entry"
          : fromScan
            ? "Review scanned prescription"
            : "Add history entry"
      }
      icon={fromScan ? <Sparkles size={20} /> : <ClipboardList size={20} />}
      onClose={onClose}
      closeOnBackdrop={false}
      className="record-modal"
      actions={
        <>
          <button type="button" className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : fromScan ? "Looks right, save" : "Save entry"}
          </button>
        </>
      }
    >
      {fromScan && (
        <div className="notice warning">
          <Sparkles size={18} aria-hidden="true" />
          <p>
            Read automatically. Please check every field against the prescription, especially doses
            and handwriting, before saving.
          </p>
        </div>
      )}
      {source && !source.startsWith("data:application/pdf") && (
        <img className="record-source" src={source} alt="Scanned prescription" />
      )}
      <div className="form-grid">
        <Field label="Type">
          <select
            className="input"
            value={v.type}
            onChange={(e) => set("type", e.target.value as MedicalRecordType)}
          >
            {(Object.keys(TYPES) as MedicalRecordType[]).map((t) => (
              <option key={t} value={t}>
                {TYPES[t].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" hint="optional">
          <input
            className="input"
            type="date"
            max={today()}
            value={v.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Title" full>
          <input
            className="input"
            value={v.title}
            maxLength={140}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Diagnosed with type 2 diabetes"
          />
        </Field>
        <Field label="Doctor" hint="optional">
          <input
            className="input"
            value={v.doctor}
            onChange={(e) => set("doctor", e.target.value)}
          />
        </Field>
        <Field label="Clinic / hospital" hint="optional">
          <input
            className="input"
            value={v.facility}
            onChange={(e) => set("facility", e.target.value)}
          />
        </Field>
        <Field label="Details" hint="optional" full>
          <textarea
            className="input textarea"
            maxLength={4000}
            value={v.details}
            onChange={(e) => set("details", e.target.value)}
          />
        </Field>
      </div>
      {(v.type === "prescription" || v.medicines.length > 0) && (
        <div className="record-meds">
          <div className="section-heading">
            <h4>Medicines on this prescription</h4>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => set("medicines", [...v.medicines, { name: "" }])}
            >
              <Plus size={14} aria-hidden="true" /> Add
            </button>
          </div>
          {v.medicines.map((m, i) => (
            <div className="record-med-row" key={i}>
              <input
                className="input"
                aria-label="Medicine name"
                placeholder="Name"
                value={m.name}
                onChange={(e) => setMed(i, { name: e.target.value })}
              />
              <input
                className="input"
                aria-label="Strength"
                placeholder="Strength"
                value={m.strength || ""}
                onChange={(e) => setMed(i, { strength: e.target.value })}
              />
              <input
                className="input"
                aria-label="Frequency"
                placeholder="How often"
                value={m.frequency || ""}
                onChange={(e) => setMed(i, { frequency: e.target.value })}
              />
              <input
                className="input"
                aria-label="Duration"
                placeholder="For how long"
                value={m.duration || ""}
                onChange={(e) => setMed(i, { duration: e.target.value })}
              />
              <input
                className="input"
                aria-label="Instructions"
                placeholder="Instructions"
                value={m.instructions || ""}
                onChange={(e) => setMed(i, { instructions: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${m.name || "medicine"}`}
                onClick={() =>
                  set(
                    "medicines",
                    v.medicines.filter((_, j) => j !== i),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {v.medicines.length === 0 && <small className="muted">No medicines listed.</small>}
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}
