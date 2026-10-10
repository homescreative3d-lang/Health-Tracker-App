import { CalendarClock, PauseCircle, Pencil, Play, Plus, Trash2 } from "lucide-react";
import type { Medicine } from "../../api";
import { dateLabel, fmtTime } from "../../lib/dates";
import { plural } from "../../lib/text";
import { frequencyLabel, isPausedOn } from "../../constants/options";
import { MedicineArt } from "../../components/art/MedicineArt";
import { EmptyArt } from "../../components/art/EmptyArt";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonList } from "../../components/Skeleton";

type MedicinesProps = {
  meds: Medicine[];
  /** False when no patient exists yet (medicines need a patient). */
  hasPatient: boolean;
  onAdd: () => void;
  onAddPatient: () => void;
  onEdit: (m: Medicine) => void;
  onDelete: (m: Medicine) => void;
  /** Ends a pause (new: paused medicines previously could not be resumed). */
  onResume: (m: Medicine) => Promise<void>;
  /** True while the plan reloads. */
  loading?: boolean;
  /** Opens the reschedule dialog (whole schedule) for a medicine. */
  onReschedule: (m: Medicine) => void;
  /** Medicine just added or rescheduled: its card pops in and glows briefly. */
  highlightId?: string | null;
};

/**
 * Supply level bar. The scale is relative to the refill threshold (full = 4× threshold,
 * min 30 doses) because the original pack size isn't stored; a marker shows the threshold.
 */
function SupplyGauge({ supply, threshold }: { supply: number; threshold: number }) {
  const scale = Math.max(30, threshold * 4, supply);
  const pct = Math.max(2, Math.min(100, (supply / scale) * 100));
  const low = threshold > 0 && supply <= threshold;
  return (
    <div className={low ? "supply-gauge low" : "supply-gauge"}>
      <div className="supply-gauge-head">
        <span>{plural(supply, "dose")} left</span>
        {low ? <b>Refill soon</b> : threshold > 0 && <small>Refill at {threshold}</small>}
      </div>
      <div
        className="supply-track"
        role="img"
        aria-label={`${supply} doses left${low ? ", refill soon" : ""}`}
      >
        <span className="supply-fill" style={{ width: `${pct}%` }} />
        {threshold > 0 && (
          <span className="supply-marker" style={{ left: `${(threshold / scale) * 100}%` }} />
        )}
      </div>
    </div>
  );
}

/** Medicine cabinet: every medicine with schedule, supply, pause state and actions. */
export function Medicines({
  meds,
  hasPatient,
  onAdd,
  onAddPatient,
  onEdit,
  onDelete,
  onResume,
  loading = false,
  onReschedule,
  highlightId,
}: MedicinesProps) {
  const active = meds.filter((m) => !isPausedOn(m)).length;
  return (
    <div className="page-scroll">
      <PageHeader
        kicker="Medicines"
        title="Medicine cabinet"
        description={`${plural(active, "active medicine")}${meds.length > active ? ` · ${meds.length - active} paused` : ""}`}
        actions={
          hasPatient && (
            <button className="btn primary" onClick={onAdd}>
              <Plus size={17} aria-hidden="true" />
              Add medicine
            </button>
          )
        }
      />
      {loading ? (
        <SkeletonList rows={3} label="Loading medicines" />
      ) : !meds.length ? (
        <div className="card empty-card">
          <EmptyArt kind={hasPatient ? "pills" : "patient"} />
          <b>{hasPatient ? "No medicines yet" : "Add a patient first"}</b>
          <span className="muted">
            {hasPatient
              ? "Add a medicine to create its schedule and refill reminders."
              : "Medicines belong to a patient. Add yourself or the person you care for."}
          </span>
          <button className="btn primary" onClick={hasPatient ? onAdd : onAddPatient}>
            <Plus size={17} aria-hidden="true" />
            {hasPatient ? "Add medicine" : "Add patient"}
          </button>
        </div>
      ) : (
        <div className="medicine-grid">
          {meds.map((m) => {
            const paused = isPausedOn(m);
            return (
              <article
                className={[
                  "card",
                  "med-card",
                  paused ? "is-paused" : "",
                  m.rescheduledFromId ? "is-rescheduled" : "",
                  highlightId === m.id ? "is-new" : "",
                ].join(" ")}
                key={m.id}
              >
                <div className="med-top">
                  <MedicineArt form={m.form} size={56} />
                  <div className="med-info">
                    <b>{m.name}</b>
                    <span>
                      {m.strength || "Strength not set"} · {m.form}
                    </span>
                    {m.condition && <span className="muted">For {m.condition}</span>}
                  </div>
                </div>
                {m.rescheduledFromId && (
                  <div className="resched-note">
                    <span className="resched-badge">
                      <CalendarClock size={12} aria-hidden="true" />
                      Rescheduled
                    </span>
                    <small>
                      Since {dateLabel(m.startDate)}
                      {m.previousTimes?.length
                        ? ` · was ${m.previousTimes.map(fmtTime).join(", ")}`
                        : ""}
                    </small>
                  </div>
                )}
                <div className="med-meta">
                  {paused && (
                    <span className="status-chip status-info">
                      <PauseCircle size={14} aria-hidden="true" />
                      Paused
                    </span>
                  )}
                  <span>{frequencyLabel(m)}</span>
                  <span>{m.times.map(fmtTime).join(", ")}</span>
                  {m.withFood && <span>With food</span>}
                </div>
                <SupplyGauge
                  supply={m.supplyCount}
                  threshold={m.isRecurring ? m.refillThreshold : 0}
                />
                <div className="med-actions">
                  {paused ? (
                    <button className="btn soft" onClick={() => onResume(m)}>
                      <Play size={15} aria-hidden="true" />
                      Resume
                    </button>
                  ) : (
                    <>
                      <button className="btn soft" onClick={() => onEdit(m)}>
                        <Pencil size={15} aria-hidden="true" />
                        Edit
                      </button>
                      <button className="btn soft" onClick={() => onReschedule(m)}>
                        <CalendarClock size={15} aria-hidden="true" />
                        Reschedule
                      </button>
                    </>
                  )}
                  <button
                    className="btn danger-ghost icon-only"
                    onClick={() => onDelete(m)}
                    aria-label={`Delete ${m.name}`}
                    title="Delete"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
