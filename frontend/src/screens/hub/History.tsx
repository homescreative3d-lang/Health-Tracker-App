import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { api, type HistoryRow, type Patient } from "../../api";
import { fmtTime } from "../../lib/dates";
import { err } from "../../lib/errors";
import { initials } from "../../lib/text";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonList } from "../../components/Skeleton";

/**
 * Filterable dose history across all accessible patients (max 1,000 most recent rows).
 * The table collapses into stacked cards on phones.
 */
export function History({ patients, patient }: { patients: Patient[]; patient: Patient }) {
  const [rows, setRows] = useState<HistoryRow[]>([]),
    [selected, setSelected] = useState<string[]>(patient.id ? [patient.id] : []),
    [medicine, setMedicine] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [period, setPeriod] = useState("");
  useEffect(() => {
    setSelected(patient.id ? [patient.id] : []);
  }, [patient.id]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Debounce the free-text medicine filter so typing doesn't fire a request per keystroke.
  const [medicineQuery, setMedicineQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setMedicineQuery(medicine.trim()), 300);
    return () => window.clearTimeout(t);
  }, [medicine]);

  // Load history whenever a filter changes; stale responses are ignored.
  useEffect(() => {
    const q = new URLSearchParams();
    if (selected.length) q.set("patientIds", selected.join(","));
    if (medicineQuery) q.set("medicineName", medicineQuery);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (period) q.set("period", period);
    let active = true;
    setLoading(true);
    setError("");
    api
      .getHistory("?" + q.toString())
      .then((r) => active && setRows(r))
      .catch((e) => {
        if (!active) return;
        setRows([]);
        setError(err(e));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [selected, medicineQuery, from, to, period]);

  return (
    <div className="page-scroll history-page">
      <PageHeader
        kicker="Care history"
        title="History"
        description="Every dose with its patient, time, outcome and who recorded it."
      />
      <div className="card history-filters">
        <div className="section-heading">
          <div>
            <h3>Filter history</h3>
            <p className="muted">Choose one or more patients, medicines or dates.</p>
          </div>
          <Clock3 aria-hidden="true" />
        </div>
        {/* fieldset, not label: a <label> wrapping buttons re-clicks the first chip. */}
        <fieldset className="field">
          <legend className="field-label">Patients</legend>
          <div className="chips">
            {patients.map((p) => (
              <button
                type="button"
                aria-pressed={selected.includes(p.id)}
                className={selected.includes(p.id) ? "chip selected" : "chip"}
                key={p.id}
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
        <Field label="Medicine name">
          <input
            className="input"
            value={medicine}
            onChange={(e) => setMedicine(e.target.value)}
            placeholder="Search medicine"
          />
        </Field>
        <div className="history-filter-grid">
          <Field label="From date">
            <input
              className="input"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              className="input"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Time of day">
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="">Any time</option>
              <option>Morning</option>
              <option value="Noon">Afternoon</option>
              <option>Evening</option>
              <option>Night</option>
            </select>
          </Field>
          <button
            className="btn soft history-clear"
            onClick={() => {
              setSelected(patient.id ? [patient.id] : []);
              setMedicine("");
              setFrom("");
              setTo("");
              setPeriod("");
            }}
          >
            Reset filters
          </button>
        </div>
      </div>
      <div className="history-results-head">
        <div>
          <h3>Dose records</h3>
          <span className="muted">
            {loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>
      {error && <InlineError>{error}</InlineError>}
      <div className="card history-table-wrap" aria-busy={loading}>
        {loading && !rows.length ? (
          <SkeletonList rows={4} label="Loading history" />
        ) : rows.length ? (
          <div className="history-table-scroll">
            <table className="history-data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medicine</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Patient">
                      <div className="history-patient-cell">
                        <span className="history-avatar">{initials(r.patientName)}</span>
                        <b>{r.patientName || "Unknown patient"}</b>
                      </div>
                    </td>
                    <td data-label="Medicine">
                      <div className="history-medication">
                        <span className="dose-icon">
                          <MedicineFormIcon form={r.form} size={17} />
                        </span>
                        <div>
                          <b>{r.medicineName}</b>
                          <small>{r.form || "Medicine"}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Scheduled">
                      <b>{r.date}</b>
                      <small>{fmtTime(r.time)}</small>
                    </td>
                    <td data-label="Status">
                      <span
                        className={
                          r.status === "taken"
                            ? "history-status taken"
                            : r.status === "missed" || r.status === "skipped"
                              ? "history-status missed"
                              : "history-status pending"
                        }
                      >
                        {r.status === "taken"
                          ? "Taken"
                          : r.status === "skipped"
                            ? "Skipped"
                            : r.status === "missed"
                              ? "Missed"
                              : r.status}
                      </span>
                    </td>
                    <td data-label="Recorded by">{r.actionedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty">
            <div className="empty-icon">
              <Clock3 aria-hidden="true" />
            </div>
            <b>No history records found</b>
            <span className="muted">
              Try adjusting your filters or check back after scheduled doses.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
