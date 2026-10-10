import { useEffect, useState } from "react";
import { Clock3, ListTree, Table2 } from "lucide-react";
import { api, type HistoryRow, type Patient } from "../../api";
import { dateLabel, fmtTime, part } from "../../lib/dates";
import { err } from "../../lib/errors";
import { initials } from "../../lib/text";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";
import { PageHeader } from "../../components/PageHeader";
import { EmptyArt } from "../../components/art/EmptyArt";
import { SkeletonList } from "../../components/Skeleton";

/**
 * Day-grouped timeline: each dose is a node colored by outcome on a rail colored by daypart.
 * @param rows - History rows (newest first).
 */
function HistoryTimeline({ rows }: { rows: HistoryRow[] }) {
  const days = rows.reduce<Record<string, HistoryRow[]>>((acc, r) => {
    (acc[r.date] ||= []).push(r);
    return acc;
  }, {});
  return (
    <div className="history-timeline">
      {Object.entries(days).map(([date, items]) => (
        <section className="timeline-day" key={date}>
          <h4>{dateLabel(date)}</h4>
          <ol>
            {items.map((r) => (
              <li
                key={r.id}
                className={`timeline-item st-${r.status} part-${part(r.time).toLowerCase()}`}
              >
                <span className="timeline-dot" aria-hidden="true" />
                <time>{fmtTime(r.time)}</time>
                <div className="timeline-copy">
                  <b>{r.medicineName}</b>
                  <small>
                    {r.patientName}
                    {r.actionedByName ? ` · by ${r.actionedByName}` : ""}
                  </small>
                </div>
                <span
                  className={`history-status ${r.status === "taken" ? "taken" : r.status === "missed" || r.status === "skipped" ? "missed" : "pending"}`}
                >
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

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
  const [view, setView] = useState<"timeline" | "table">("timeline");
  const counts = {
    taken: rows.filter((r) => r.status === "taken").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    missed: rows.filter((r) => r.status === "missed").length,
    pending: rows.filter((r) => !["taken", "skipped", "missed"].includes(r.status)).length,
  };
  const recorded = counts.taken + counts.skipped + counts.missed;
  const rate = recorded ? Math.round((counts.taken / recorded) * 100) : 0;
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
        <div className="view-toggle" role="radiogroup" aria-label="History view">
          {(["timeline", "table"] as const).map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={view === v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
            >
              {v === "timeline" ? (
                <ListTree size={16} aria-hidden="true" />
              ) : (
                <Table2 size={16} aria-hidden="true" />
              )}
              {v === "timeline" ? "Timeline" : "Table"}
            </button>
          ))}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="history-summary">
          {[
            ["taken", "Taken", counts.taken],
            ["skipped", "Skipped", counts.skipped],
            ["missed", "Missed", counts.missed],
            ["pending", "Pending", counts.pending],
          ].map(([k, label, n]) => (
            <div className={`summary-chip s-${k}`} key={k as string}>
              <b>{n as number}</b>
              <span>{label as string}</span>
            </div>
          ))}
          <div className="summary-chip s-rate">
            <b>{rate}%</b>
            <span>Taken of recorded</span>
          </div>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
      <div className="card history-table-wrap" aria-busy={loading}>
        {loading && !rows.length ? (
          <SkeletonList rows={4} label="Loading history" />
        ) : rows.length && view === "timeline" ? (
          <HistoryTimeline rows={rows} />
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
            <EmptyArt kind="history" />
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
