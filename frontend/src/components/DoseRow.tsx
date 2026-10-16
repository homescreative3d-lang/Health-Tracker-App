import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  Clock3,
  CornerUpRight,
  Lock,
  RotateCcw,
  UserRound,
  X,
  History as HistoryIcon,
} from "lucide-react";
import type { Dose } from "../api";
import { dateLabel, fmtTime } from "../lib/dates";
import { doseWindow, doseWindowHours, windowClosesAt, type DoseWindow } from "../lib/doseWindow";
import { useNow } from "../hooks/useNow";
import { MedicineArt } from "./art/MedicineArt";

/** Actions a user can perform on a dose. */
export type DoseAction = "taken" | "skip" | "undo";

type DoseRowProps = {
  /** The dose to render. */
  d: Dose;
  /** Date being viewed (`YYYY-MM-DD`), needed to compute the action window. */
  date: string;
  /** Performs an action; resolves when the API call completes. */
  onDose: (d: Dose, action: DoseAction) => Promise<void> | void;
  /** Opens the reschedule dialog for this dose. */
  onReschedule?: (d: Dose) => void;
  /** False for read-only viewers (linked patients without permission): hides Take/Skip/Undo. */
  canAct?: boolean;
};

/** Status chip text, chip style and icon tone for a dose (from the patient's point of view). */
function statusOf(d: Dose, w: DoseWindow) {
  if (d.status === "taken") return { label: "Taken", className: "status-success", tone: "taken" };
  if (d.status === "skipped")
    return { label: "Skipped", className: "status-skipped", tone: "skipped" };
  if (d.status === "rescheduled")
    return {
      label: d.rescheduleTo
        ? `Moved to ${dateLabel(d.rescheduleTo)}${d.rescheduleToTime ? `, ${fmtTime(d.rescheduleToTime)}` : ""}`
        : "Moved",
      className: "status-info",
      tone: "moved",
    };
  if (w === "locked") return { label: "Missed", className: "status-danger", tone: "missed" };
  if (w === "upcoming") return { label: "Upcoming", className: "status-info", tone: "" };
  if (w === "late") return { label: "Late", className: "status-late", tone: "due" };
  // The API flags overdue doses "missed" as soon as the time passes, but they stay
  // actionable for an hour, so the UI presents them as due.
  return { label: "Due now", className: "status-pending", tone: "due" };
}

/** Animation class to play after an action, keyed by the resulting status change. */
function activityClass(prev: string, next: string): string | null {
  if (prev === next) return null;
  if (next === "taken") return "just-taken";
  if (next === "skipped") return "just-skipped";
  if (next === "rescheduled") return "just-moved";
  if (prev === "taken" || prev === "skipped" || prev === "rescheduled") return "just-undone";
  return null;
}

/**
 * One dose in the schedule.
 *
 * - Mirrors the API's action window (default 12 hours): upcoming → due now → late (still
 *   recordable) → missed.
 * - Highlights the dose whose time is now with a glowing border; re-checks every 30 seconds.
 * - Status reads from the patient's side ("Taken"); the caregiver who recorded it is shown
 *   separately ("Recorded by Priya") only when it wasn't the patient themself.
 * - Rescheduled doses are marked on both ends: "Moved to …" and "Rescheduled · from …".
 * - Each action plays its own short animation.
 */
export function DoseRow({ d, date, onDose, onReschedule, canAct = true }: DoseRowProps) {
  const now = useNow();
  const [busy, setBusy] = useState<DoseAction | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  // Only changes worth showing on the card (not routine take/skip, which the status already shows).
  const history = (d.history || []).filter(
    (h) => h.action === "rescheduled" || h.action === "undone",
  );
  const actionWindow = doseWindow(date, d, now);
  const status = statusOf(d, actionWindow);
  const acted = d.status === "taken" || d.status === "skipped";
  const moved = d.status === "rescheduled";
  const dueNow = actionWindow === "open" && !acted && !moved && canAct;
  // Late doses can still be recorded until the window closes.
  const recordable =
    (actionWindow === "open" || actionWindow === "late") && !acted && !moved && canAct;
  const canReschedule = !acted && !moved && !!onReschedule;
  const recordedBy =
    (acted || moved) && d.actionedByName && d.actionedByName.trim() !== (d.patientName || "").trim()
      ? d.actionedByName
      : null;

  // Play an animation matching the status change the user just caused.
  const [activity, setActivity] = useState<string | null>(null);
  const prevStatus = useRef(d.status);
  useEffect(() => {
    const cls = activityClass(prevStatus.current, d.status);
    prevStatus.current = d.status;
    if (!cls) return;
    setActivity(cls);
    const t = window.setTimeout(() => setActivity(null), 900);
    return () => window.clearTimeout(t);
  }, [d.status]);

  /** Runs an action with a per-row busy flag to prevent double submits. */
  const run = async (action: DoseAction) => {
    if (busy) return;
    setBusy(action);
    try {
      await onDose(d, action);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={["dose-row", `is-${d.status}`, dueNow ? "is-due-now" : "", activity || ""]
        .join(" ")
        .trim()}
      data-window={actionWindow}
      aria-current={dueNow ? "time" : undefined}
    >
      <div className={`dose-icon ${status.tone}`}>
        <MedicineArt form={d.form} size={44} />
        {d.status === "taken" && (
          <span className="dose-icon-check" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="dose-main">
        <div className="dose-top">
          <div className="dose-title">
            <b>
              {d.medName}
              {d.rescheduledFromId && (
                <span className="resched-badge" title="This dose was rescheduled">
                  <CalendarClock size={12} aria-hidden="true" />
                  Rescheduled
                </span>
              )}
            </b>
            {d.doseAmount && <span className="dose-amount">Take {d.doseAmount}</span>}
            <span className="muted">
              {[
                d.strength,
                d.withFood ? "with food" : "",
                d.liquid !== "No liquid needed" ? d.liquid : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {d.rescheduledFromId && d.rescheduledFromTime && (
              <small className="resched-from">
                <CornerUpRight size={12} aria-hidden="true" />
                Moved from {d.rescheduledFromDate ? `${dateLabel(d.rescheduledFromDate)}, ` : ""}
                {fmtTime(d.rescheduledFromTime)}
              </small>
            )}
          </div>
          <time className={moved ? "dose-time struck" : "dose-time"}>{fmtTime(d.time)}</time>
        </div>
        <div className="dose-foot">
          <span className="dose-status">
            <span className={`status-chip ${status.className}`}>
              {d.status === "taken" && <Check size={14} aria-hidden="true" />}
              {d.status === "skipped" && <X size={14} aria-hidden="true" />}
              {moved && <CalendarClock size={14} aria-hidden="true" />}
              {status.label}
            </span>
            {recordedBy && (
              <small className="recorded-by">
                <UserRound size={12} aria-hidden="true" />
                Recorded by {recordedBy}
              </small>
            )}
          </span>
          <div className="dose-actions">
            {canReschedule && (
              <button className="btn ghost sm" disabled={!!busy} onClick={() => onReschedule!(d)}>
                <CalendarClock size={15} aria-hidden="true" />
                Reschedule
              </button>
            )}
            {recordable && (
              <>
                <button className="btn soft sm" disabled={!!busy} onClick={() => run("skip")}>
                  <X size={15} aria-hidden="true" />
                  {busy === "skip" ? "Skipping…" : "Skip"}
                </button>
                <button
                  className="btn primary sm take"
                  disabled={!!busy}
                  onClick={() => run("taken")}
                >
                  <Check size={15} aria-hidden="true" />
                  {busy === "taken" ? "Saving…" : "Take"}
                </button>
              </>
            )}
            {canAct &&
              (((actionWindow === "open" || actionWindow === "late") && acted) || moved) && (
                <button
                  className="btn ghost sm undo-btn"
                  disabled={!!busy}
                  onClick={() => run("undo")}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  {busy === "undo" ? "Undoing…" : "Undo"}
                </button>
              )}
          </div>
        </div>
        {history.length > 0 && (
          <div className="dose-history">
            <button
              type="button"
              className="dose-history-toggle"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((v) => !v)}
            >
              <HistoryIcon size={13} aria-hidden="true" />
              {showHistory ? "Hide changes" : `Changed ${history.length}×`}
            </button>
            {showHistory && (
              <ol className="dose-history-list">
                {history.map((h) => (
                  <li key={h.id} className={`act-${h.action}`}>
                    <b>{h.summary}</b>
                    <small>
                      {h.actorName} ·{" "}
                      {new Date(h.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                    {h.reason && <q>{h.reason}</q>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {actionWindow === "late" && !acted && !moved && (
          <span className="dose-hint late-hint">
            <Clock3 size={14} aria-hidden="true" />
            Can still be recorded until{" "}
            {windowClosesAt(date, d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        {actionWindow === "upcoming" && !acted && !moved && (
          <span className="dose-hint">
            <Clock3 size={14} aria-hidden="true" />
            Available at {fmtTime(d.time)}
          </span>
        )}
        {actionWindow === "locked" && !acted && !moved && (
          <span className="dose-hint">
            <Lock size={14} aria-hidden="true" />
            Not recorded within {doseWindowHours()} hours.
            {canReschedule ? " You can still reschedule it." : ""}
          </span>
        )}
      </div>
    </div>
  );
}
