import { useEffect, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { api, type AuditEntry, type Patient } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { PageHeader } from "../../components/PageHeader";
import { AuditList, ACTION_LABELS } from "../modals/MedicineHistoryDialog";

/**
 * Activity log: the audit trail of every change (scheduling, rescheduling with reasons, pauses,
 * refills, edits, dose actions) with who made it and when — kept separate from dose History.
 */
export function ActivityLog({ patients, patient }: { patients: Patient[]; patient: Patient }) {
  const [selected, setSelected] = useState<string[]>(patient.id ? [patient.id] : []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [rows, setRows] = useState<{ entry: AuditEntry; patientName: string }[] | null>(null);
  const [error, setError] = useState("");

  // Reload when filters change; stale responses are ignored.
  useEffect(() => {
    const q = new URLSearchParams();
    if (selected.length) q.set("patientIds", selected.join(","));
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    let active = true;
    setRows(null);
    api
      .getChanges("?" + q.toString())
      .then((r) => active && setRows(Array.isArray(r) ? r : []))
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setError(err(e));
      });
    return () => {
      active = false;
    };
  }, [selected, from, to]);

  const shown = (rows || []).filter((r) => !action || r.entry.action === action);

  return (
    <div className="page-scroll">
      <PageHeader
        kicker="Activity log"
        title="Every change, recorded"
        description="Scheduling, rescheduling, pauses, refills and edits, with who made each change, when and why."
      />
      <section className="card history-filters">
        <fieldset className="field">
          <legend className="field-label">Patients</legend>
          <div className="chips">
            {patients.map((p) => (
              <button
                type="button"
                key={p.id}
                aria-pressed={selected.includes(p.id)}
                className={selected.includes(p.id) ? "chip selected" : "chip"}
                onClick={() =>
                  setSelected((x) =>
                    x.includes(p.id) ? x.filter((id) => id !== p.id) : [...x, p.id],
                  )
                }
              >
                {p.name || "Unnamed"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="history-filter-grid">
          <Field label="From">
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Type of change">
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All changes</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>
      {error && <InlineError>{error}</InlineError>}
      <section className="card history-changes">
        <div className="section-heading">
          <h3>
            {rows === null ? "Loading…" : `${shown.length} change${shown.length === 1 ? "" : "s"}`}
          </h3>
          <HistoryIcon size={18} aria-hidden="true" />
        </div>
        {rows !== null && <AuditList entries={shown} showPatient />}
      </section>
    </div>
  );
}
