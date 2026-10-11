import { useState } from "react";
import {
  CalendarClock,
  History,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
  PackagePlus,
  Receipt,
  PackageSearch,
} from "lucide-react";
import { MedicineHistoryDialog } from "../modals/MedicineHistoryDialog";
import { RefillDialog, RefillHistoryDialog } from "../modals/RefillDialogs";
import { formatQty, parseDose } from "../../lib/doseQuantity";
import { useCare } from "../../hooks/CareAppContext";
import { PauseDialog } from "../modals/PauseDialog";
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
  /** Opens the stock planner. */
  onOpenPlanner: () => void;
  /** Records a refill. */
  onRefill: (
    m: Medicine,
    b: { quantity: number; date?: string; pharmacy?: string; note?: string },
  ) => Promise<boolean>;
  /** Pauses a medicine (reason + double confirmation in the dialog). */
  onPause: (id: string, start: string, reason: string) => Promise<void>;
  /** Linked patient (view-only): hides every editing control. */
  readOnly?: boolean;
};

/** Label + tone for a stock status (thresholds from the server's stock projection). */
const STOCK_LABEL: Record<string, string> = {
  out: "Out of stock",
  critical: "Critical",
  low: "Low",
  ok: "In stock",
};

/**
 * Stock on hand in units and doses, labelled Out of stock / Critical / Low / In stock, with an
 * animated bar (scale: 4× the refill threshold, min 30 doses) and a marker at the threshold.
 */
function StockGauge({ m }: { m: Medicine }) {
  const { perDose, unit } = parseDose(m.doseAmount, m.form);
  const qty = m.stockQuantity ?? m.supplyCount * perDose;
  const doses = Math.floor(qty / perDose);
  const threshold = m.isRecurring ? m.refillThreshold : 0;
  const scale = Math.max(30, threshold * 4, doses);
  const status = m.stockStatus || (doses < 1 ? "out" : doses <= threshold ? "low" : "ok");
  return (
    <div className={`supply-gauge stock-${status}`}>
      <div className="supply-gauge-head">
        <span className={`stock-label s-${status}`}>{STOCK_LABEL[status]}</span>
        <span className="stock-qty">
          <b>{formatQty(qty, unit)}</b> · {doses} dose{doses === 1 ? "" : "s"}
          {m.daysLeft != null ? ` · ≈ ${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <div
        className="supply-track"
        role="img"
        aria-label={`${formatQty(qty, unit)} left, ${STOCK_LABEL[status]}`}
      >
        <span
          className="supply-fill"
          style={{ width: `${Math.max(2, Math.min(100, (doses / scale) * 100))}%` }}
        />
        {threshold > 0 && (
          <span className="supply-marker" style={{ left: `${(threshold / scale) * 100}%` }} />
        )}
      </div>
      <small className="stock-meta">
        {m.runOutDate ? `Runs out ${dateLabel(m.runOutDate)}` : "Covers the schedule ahead"}
        {m.lastRefillAt
          ? ` · last filled ${new Date(m.lastRefillAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
          : ""}
      </small>
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
  onPause,
  onRefill,
  onOpenPlanner,
  readOnly = false,
}: MedicinesProps) {
  const app = useCare();
  const [historyFor, setHistoryFor] = useState<Medicine | null>(null);
  const [pauseFor, setPauseFor] = useState<Medicine | null>(null);
  const [refillFor, setRefillFor] = useState<Medicine | null>(null);
  const [trailFor, setTrailFor] = useState<Medicine | null>(null);
  const active = meds.filter((m) => !isPausedOn(m)).length;
  return (
    <div className="page-scroll">
      <PageHeader
        kicker="Medicines"
        title="Medicine cabinet"
        description={`${plural(active, "active medicine")}${meds.length > active ? ` · ${meds.length - active} paused` : ""}`}
        actions={
          hasPatient &&
          !readOnly && (
            <>
              <button type="button" className="btn soft" onClick={onOpenPlanner}>
                <PackageSearch size={16} aria-hidden="true" /> Stock planner
              </button>
              {!readOnly && (
                <button className="btn primary" onClick={onAdd}>
                  <Plus size={17} aria-hidden="true" />
                  Add medicine
                </button>
              )}
            </>
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
                    {m.doseAmount && <span className="dose-amount">Take {m.doseAmount}</span>}
                  </div>
                </div>
                {m.rescheduledFromId && (
                  <div className="resched-note">
                    <span className="resched-badge">
                      <CalendarClock size={12} aria-hidden="true" />
                      Rescheduled
                    </span>
                    {app.can("change_history") && (
                      <button
                        type="button"
                        className="btn ghost sm history-btn"
                        onClick={() => setHistoryFor(m)}
                      >
                        <History size={13} aria-hidden="true" /> Change history
                      </button>
                    )}
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
                <StockGauge m={m} />
                <button
                  type="button"
                  className="text-btn stock-trail-btn"
                  onClick={() => setTrailFor(m)}
                >
                  <Receipt size={14} aria-hidden="true" /> Stock history
                </button>
                {!readOnly && (
                  <div className="med-actions">
                    {paused ? (
                      <button className="btn soft" onClick={() => onResume(m)}>
                        <Play size={15} aria-hidden="true" />
                        Resume
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn primary"
                          onClick={() => setRefillFor(m)}
                        >
                          <PackagePlus size={15} aria-hidden="true" />
                          Refill
                        </button>
                        <button className="btn soft" onClick={() => onEdit(m)}>
                          <Pencil size={15} aria-hidden="true" />
                          Edit
                        </button>
                        {app.can("rescheduling") && (
                          <button className="btn soft" onClick={() => onReschedule(m)}>
                            <CalendarClock size={15} aria-hidden="true" />
                            Reschedule
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn soft icon-only"
                          onClick={() => setPauseFor(m)}
                          aria-label={`Pause ${m.name}`}
                          title="Pause"
                        >
                          <PauseCircle size={16} aria-hidden="true" />
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
                )}
              </article>
            );
          })}
        </div>
      )}
      {historyFor && (
        <MedicineHistoryDialog medicine={historyFor} onClose={() => setHistoryFor(null)} />
      )}
      {pauseFor && (
        <PauseDialog medicine={pauseFor} onClose={() => setPauseFor(null)} onPause={onPause} />
      )}
      {refillFor && (
        <RefillDialog medicine={refillFor} onClose={() => setRefillFor(null)} onRefill={onRefill} />
      )}
      {trailFor && <RefillHistoryDialog medicine={trailFor} onClose={() => setTrailFor(null)} />}
    </div>
  );
}
