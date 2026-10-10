import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { api, type Dose, type Medicine, type Patient, type HistoryRow } from "../../api";
import { fmtTime } from "../../lib/dates";
import { Field } from "../../components/Field";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";

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
  useEffect(() => {
    const q = new URLSearchParams();
    if (selected.length) q.set("patientIds", selected.join(","));
    if (medicine) q.set("medicineName", medicine);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (period) q.set("period", period);
    api
      .getHistory("?" + q.toString())
      .then(setRows)
      .catch(() => setRows([]));
  }, [selected, medicine, from, to, period]);
  return (
    <div className="page-scroll history-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">CARE HISTORY</span>
          <h1>Medication history</h1>
          <p className="muted">A clear record of each dose, patient, time and caregiver.</p>
        </div>
      </div>
      <div className="card history-filters">
        <div className="section-heading">
          <div>
            <h3>Filter history</h3>
            <p className="muted">Choose one or more patients, medicines or dates.</p>
          </div>
          <Clock3 />
        </div>
        <label className="field">
          <span className="field-label">Patients</span>
          <div className="chips">
            {patients.map((p) => (
              <button
                type="button"
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
        </label>
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
              <option>Noon</option>
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
            {rows.length} record{rows.length === 1 ? "" : "s"} found
          </span>
        </div>
      </div>
      <div className="card history-table-wrap">
        {rows.length ? (
          <div className="history-table-scroll">
            <table className="history-data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medicine</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Action recorded by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="history-patient-cell">
                        <span className="history-avatar">
                          {(r.patientName || "?")
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <b>{r.patientName || "Unknown patient"}</b>
                      </div>
                    </td>
                    <td>
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
                    <td>
                      <b>{r.date}</b>
                      <small>{fmtTime(r.time)}</small>
                    </td>
                    <td>
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
                    <td>{r.actionedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="history-empty">
            <div className="empty-icon">
              <Clock3 />
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
