import React from "react";
import { AlertCircle, HeartPulse, Info, Pill, Plus, UserPlus } from "lucide-react";
import type { Dose, Medicine, Patient } from "../../api";
import type { DayPart } from "../../lib/dates";
import { plural } from "../../lib/text";
import { isPausedOn } from "../../constants/options";
import { Avatar } from "../../components/Avatar";
import { DoseGroup } from "../../components/DoseGroup";
import { DoseRow, type DoseAction } from "../../components/DoseRow";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonList } from "../../components/Skeleton";

type TodayProps = {
  patient: Patient;
  patients: Patient[];
  onPatientSelect: (p: Patient) => Promise<void>;
  /** Doses grouped by daypart. */
  grouped: { name: DayPart; items: Dose[] }[];
  meds: Medicine[];
  /** Always today's date (the controller enforces this). */
  date: string;
  onDose: (d: Dose, a: DoseAction) => Promise<void>;
  onAdd: () => void;
  onAddPatient: () => void;
  onPatientInfo: () => void;
  /** True while switching patients or reloading the plan. */
  loading?: boolean;
};

/** Returns a time-of-day greeting for the page kicker. */
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/**
 * Today's schedule: adherence summary, refill warnings and doses grouped like a pill organizer.
 * Patients can be switched with the pills at the top.
 */
export function Today({
  patient,
  patients,
  onPatientSelect,
  grouped,
  meds,
  date,
  onDose,
  onAdd,
  onAddPatient,
  onPatientInfo,
  loading = false,
}: TodayProps) {
  const all = grouped.flatMap((g) => g.items);
  const total = all.length;
  const taken = all.filter((d) => d.status === "taken").length;
  const missed = all.filter((d) => d.status === "skipped" || d.status === "missed").length;
  const decided = taken + missed;
  const adherence = decided ? Math.round((taken / decided) * 100) : 0;
  const remaining = Math.max(0, total - decided);
  const low = meds.filter(
    (m) => m.isRecurring && m.supplyCount <= m.refillThreshold && !isPausedOn(m),
  );
  const firstName = patient.name.split(" ")[0];

  return (
    <div className="page-scroll">
      <PageHeader
        kicker={greeting()}
        title={patient.name ? `${firstName}'s doses today` : "Welcome to Tended"}
        description={
          patient.name
            ? new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Add the person you care for (or yourself) to start a medicine plan."
        }
        actions={
          patient.id ? (
            <button className="btn soft" onClick={onPatientInfo}>
              <Info size={17} aria-hidden="true" />
              Patient info
            </button>
          ) : undefined
        }
      />

      {patients.length > 1 && (
        <div className="patient-switcher" role="tablist" aria-label="Choose patient">
          {patients.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === patient.id}
              className={p.id === patient.id ? "patient-pill active" : "patient-pill"}
              onClick={() => onPatientSelect(p)}
            >
              <Avatar name={p.name} src={p.profileImageUrl} size="sm" />
              <span>{p.name || "Unnamed patient"}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <SkeletonList rows={3} label="Loading schedule" />}

      {!loading && total > 0 && (
        <div className="progress-card card">
          <div className="progress-copy">
            <span className="muted">Today's adherence</span>
            <div className="progress-stats">
              <span className="stat taken">
                <b>{taken}</b> taken
              </span>
              <span className="stat missed">
                <b>{missed}</b> missed
              </span>
              <span className="stat remaining">
                <b>{remaining}</b> to go
              </span>
            </div>
            <small className="muted">Skipped doses count as missed.</small>
          </div>
          <div
            className="progress-ring"
            role="img"
            aria-label={`${adherence}% of actioned doses taken`}
            style={{ "--progress": adherence } as React.CSSProperties}
          >
            <span>{adherence}%</span>
          </div>
        </div>
      )}

      {low.length > 0 && (
        <div className="notice warning" role="status">
          <AlertCircle aria-hidden="true" />
          <div>
            <b>Refill soon</b>
            <p>
              {low.map((m) => `${m.name} (${m.supplyCount} left)`).join(", ")}{" "}
              {low.length === 1 ? "is" : "are"} running low.
            </p>
          </div>
        </div>
      )}

      {!loading && total > 0 && (
        <>
          <div className="section-heading">
            <h3>Schedule</h3>
            <span className="muted">{plural(total, "dose")}</span>
          </div>
          {grouped.map(
            (g) =>
              g.items.length > 0 && (
                <DoseGroup key={g.name} name={g.name} count={g.items.length}>
                  {g.items.map((d) => (
                    <DoseRow d={d} key={d.id} date={date} onDose={onDose} />
                  ))}
                </DoseGroup>
              ),
          )}
          <button className="btn soft full add-btn" onClick={onAdd}>
            <Plus size={18} aria-hidden="true" />
            Add another medicine
          </button>
        </>
      )}

      {!loading && total === 0 && (
        <div className="card empty-card">
          <div className="empty-icon">
            {patient.id ? <Pill aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
          </div>
          <b>
            {!patient.id
              ? "No patient added yet"
              : meds.length
                ? "Nothing scheduled today"
                : "Start this medicine plan"}
          </b>
          <span className="muted">
            {!patient.id
              ? "Add a patient to begin tracking medicines and reminders."
              : meds.length
                ? "Check the calendar for upcoming doses."
                : "Add the first medicine and Tended will build the daily schedule."}
          </span>
          <button className="btn primary" onClick={patient.id ? onAdd : onAddPatient}>
            <Plus size={18} aria-hidden="true" />
            {patient.id ? "Add medicine" : "Add patient"}
          </button>
        </div>
      )}

      <div className="tip-card">
        <HeartPulse aria-hidden="true" />
        <div>
          <b>One shared record for the family</b>
          <p>Doses marked here are visible to every approved caregiver, with who marked them.</p>
        </div>
      </div>
    </div>
  );
}
