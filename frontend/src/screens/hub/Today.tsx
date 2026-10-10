import React from "react";
import { AlertCircle, Check, HeartPulse, Info, Pill, Plus } from "lucide-react";
import { type Dose, type Medicine, type Patient, type Family } from "../../api";
import { today } from "../../lib/dates";
import { DoseRow } from "../../components/DoseRow";
import { Profile } from "./Profile";

export function Today({
  patient,
  patients,
  onPatientSelect,
  grouped,
  meds,
  onDose,
  onAdd,
  onAddPatient,
  onGuide,
  onPatientInfo,
}: {
  patient: Patient;
  patients: Patient[];
  onPatientSelect: (p: Patient) => Promise<void>;
  grouped: { name: string; items: Dose[] }[];
  meds: Medicine[];
  onDose: (d: Dose, a: "taken" | "skip") => void;
  onAdd: () => void;
  onAddPatient: () => void;
  onGuide: () => void;
  onPatientInfo: () => void;
}) {
  const first = patient.name.split(" ")[0] || "Your";
  const total = grouped.reduce((n, g) => n + g.items.length, 0);
  const taken = grouped.reduce((n, g) => n + g.items.filter((d) => d.status === "taken").length, 0);
  const missed = grouped.reduce(
    (n, g) => n + g.items.filter((d) => d.status === "skipped" || d.status === "missed").length,
    0,
  );
  const decided = taken + missed;
  const adherence = decided ? Math.round((taken / decided) * 100) : 0;
  const remaining = Math.max(0, total - decided);
  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const low = meds.filter((m) => m.supplyCount <= m.refillThreshold);
  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <span className="eyebrow">{greet.toUpperCase()}</span>
          <h1>{patient.name ? first + "'s doses today" : "Welcome to TENDED"}</h1>
          <p className="muted">
            {patient.name
              ? "Select a family patient to manage their care plan."
              : "Your home is ready. Add a patient when you are ready, or join an existing family."}
          </p>
        </div>
        <button
          className="circle-help"
          onClick={onPatientInfo}
          title="View patient information"
          aria-label="View patient information"
        >
          <Info />
        </button>
      </div>
      <div className="patient-switcher">
        {patients.map((p) => (
          <button
            key={p.id}
            className={p.id === patient.id ? "patient-pill active" : "patient-pill"}
            onClick={() => onPatientSelect(p)}
          >
            <span className="patient-avatar">
              {(p.name || "?")
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>{p.name || "Unnamed patient"}</span>
          </button>
        ))}
      </div>
      <div className="progress-card">
        <div>
          <span className="muted">Today’s adherence (actioned doses)</span>
          <strong>
            {taken} taken · {missed} missed · {remaining} remaining
          </strong>
          <small className="muted">Skipped doses count as missed.</small>
        </div>
        <div className="progress-ring" style={{ "--progress": adherence } as React.CSSProperties}>
          <span>{adherence}%</span>
        </div>
      </div>
      {low.length > 0 && (
        <div className="notice warning">
          <AlertCircle />
          <div>
            <b>Refill reminder</b>
            <p>
              {low.map((m) => m.name).join(", ")} {low.length === 1 ? "is" : "are"} running low.
            </p>
          </div>
        </div>
      )}
      <div className="section-heading">
        <h3>Today's schedule</h3>
        <span className="muted">
          {total} dose{total !== 1 ? "s" : ""}
        </span>
      </div>
      {grouped.map(
        (g) =>
          g.items.length > 0 && (
            <div className="dose-group" key={g.name}>
              <h4>{g.name}</h4>
              <div className="card dose-card">
                {g.items.map((d) => (
                  <DoseRow d={d} key={d.id} onDose={onDose} />
                ))}
              </div>
            </div>
          ),
      )}
      {total === 0 && (
        <div className="card empty-card">
          <div className="empty-icon">
            <Pill />
          </div>
          <b>
            {!patient.id
              ? "No patient added yet"
              : meds.length
                ? "Nothing scheduled for this day"
                : "Start this patient's medication plan"}
          </b>
          <span className="muted">
            {!patient.id
              ? "Add a patient from Profile to begin managing medicines."
              : meds.length
                ? "Check another date or review the schedule."
                : "Add the first medicine for this patient."}
          </span>
          <button className="btn accent" onClick={patient.id ? onAdd : onAddPatient}>
            <Plus size={18} />
            {patient.id ? "Add medicine" : "Add patient"}
          </button>
        </div>
      )}
      {total > 0 && (
        <button className="btn soft full add-btn" onClick={onAdd}>
          <Plus size={18} />
          Add another medicine
        </button>
      )}
      <div className="tip-card">
        <HeartPulse />
        <div>
          <b>Family care, one shared record.</b>
          <p>
            Changes are tied to the selected patient so approved family members can coordinate care.
          </p>
        </div>
      </div>
    </div>
  );
}
