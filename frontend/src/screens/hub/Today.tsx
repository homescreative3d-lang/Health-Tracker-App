import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, HeartPulse, Info, Plus } from "lucide-react";
import type { Dose, Medicine, Patient } from "../../api";
import type { DayPart } from "../../lib/dates";
import { plural } from "../../lib/text";
import { isPausedOn } from "../../constants/options";
import { Avatar } from "../../components/Avatar";
import { DoseGroup } from "../../components/DoseGroup";
import { DoseRow, type DoseAction } from "../../components/DoseRow";
import { SkyScene } from "../../components/art/SkyScene";
import { EmptyArt } from "../../components/art/EmptyArt";
import { Celebration } from "../../components/art/Celebration";
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
  const allTaken = total > 0 && taken === total;
  // Celebrate once when the last dose of the day is taken during this visit.
  const [celebrate, setCelebrate] = useState(false);
  const prevTaken = useRef(taken);
  useEffect(() => {
    if (allTaken && prevTaken.current < taken) {
      setCelebrate(true);
      const t = window.setTimeout(() => setCelebrate(false), 1600);
      prevTaken.current = taken;
      return () => window.clearTimeout(t);
    }
    prevTaken.current = taken;
  }, [allTaken, taken]);

  return (
    <div className="page-scroll">
      <section className="today-hero">
        <div className="today-hero-copy">
          <span className="eyebrow">{greeting()}</span>
          <h1>{patient.name ? `${firstName}'s doses today` : "Welcome to Tended"}</h1>
          <p>
            {patient.name
              ? new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Add the person you care for (or yourself) to start a medicine plan."}
          </p>
          {patient.id && (
            <button className="btn soft sm" onClick={onPatientInfo}>
              <Info size={16} aria-hidden="true" />
              Patient info
            </button>
          )}
        </div>
        <SkyScene />
      </section>

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
        <div className={allTaken ? "progress-card card is-complete" : "progress-card card"}>
          {celebrate && <Celebration />}
          <div
            className="progress-ring"
            role="img"
            aria-label={`${adherence}% of actioned doses taken`}
            style={{ "--progress": adherence } as React.CSSProperties}
          >
            <span>
              <b>{adherence}%</b>
              <small>adherence</small>
            </span>
          </div>
          <div className="progress-copy">
            <b className="progress-headline">
              {allTaken
                ? "Every dose taken today. Lovely work."
                : remaining > 0
                  ? `${remaining} dose${remaining === 1 ? "" : "s"} still to go`
                  : "Today's doses are all recorded"}
            </b>
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
            <div className="progress-bar" aria-hidden="true">
              <span className="seg taken" style={{ flexGrow: taken }} />
              <span className="seg missed" style={{ flexGrow: missed }} />
              <span className="seg remaining" style={{ flexGrow: remaining }} />
            </div>
            <small className="muted">Skipped doses count as missed.</small>
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
          <EmptyArt kind={patient.id ? (meds.length ? "calendar" : "pills") : "patient"} />
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
