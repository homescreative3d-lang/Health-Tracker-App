import { PauseCircle, Pencil, Pill, Play, Plus, Trash2, UserPlus } from "lucide-react";
import type { Medicine } from "../../api";
import { fmtTime } from "../../lib/dates";
import { plural } from "../../lib/text";
import { frequencyLabel, isPausedOn } from "../../constants/options";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";
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
};

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
          <div className="empty-icon">
            {hasPatient ? <Pill aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
          </div>
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
            const low = m.isRecurring && m.supplyCount <= m.refillThreshold;
            return (
              <article className={paused ? "card med-card is-paused" : "card med-card"} key={m.id}>
                <div className="med-top">
                  <div className="dose-icon">
                    <MedicineFormIcon form={m.form} size={22} />
                  </div>
                  <div className="med-info">
                    <b>{m.name}</b>
                    <span>
                      {m.strength || "Strength not set"} · {m.form}
                    </span>
                    {m.condition && <span className="muted">For {m.condition}</span>}
                  </div>
                </div>
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
                <div className={low ? "supply low" : "supply"}>
                  <span>{plural(m.supplyCount, "dose")} left</span>
                  {low && <b>Refill soon</b>}
                </div>
                <div className="med-actions">
                  {paused ? (
                    <button className="btn soft" onClick={() => onResume(m)}>
                      <Play size={15} aria-hidden="true" />
                      Resume
                    </button>
                  ) : (
                    <button className="btn soft" onClick={() => onEdit(m)}>
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </button>
                  )}
                  <button
                    className="btn danger-ghost"
                    onClick={() => onDelete(m)}
                    aria-label={`Delete ${m.name}`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete
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
