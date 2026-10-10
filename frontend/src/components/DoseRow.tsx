import { useState } from "react";
import { Check, Clock3, Lock, RotateCcw, X } from "lucide-react";
import type { Dose } from "../api";
import { fmtTime } from "../lib/dates";
import { doseWindow } from "../lib/doseWindow";
import { MedicineFormIcon } from "./MedicineFormIcon";

/** Actions a user can perform on a dose. */
export type DoseAction = "taken" | "skip" | "undo";

type DoseRowProps = {
  /** The dose to render. */
  d: Dose;
  /** Date being viewed (`YYYY-MM-DD`), needed to compute the action window. */
  date: string;
  /** Performs an action; resolves when the API call completes. */
  onDose: (d: Dose, action: DoseAction) => Promise<void> | void;
};

/** Status chip text + style for a dose. */
function statusOf(d: Dose, window: ReturnType<typeof doseWindow>) {
  if (d.status === "taken") return { label: "Taken", className: "status-success", tone: "taken" };
  if (d.status === "skipped")
    return { label: "Skipped", className: "status-danger", tone: "skipped" };
  if (d.status === "rescheduled")
    return { label: "Rescheduled", className: "status-info", tone: "" };
  if (window === "locked") return { label: "Missed", className: "status-danger", tone: "missed" };
  if (window === "upcoming") return { label: "Upcoming", className: "status-info", tone: "" };
  // The API flags overdue doses as "missed" as soon as the time passes, but they stay
  // actionable for an hour, so the UI presents them as due.
  return { label: "Due now", className: "status-pending", tone: "due" };
}

/**
 * One dose in the schedule.
 *
 * Mirrors the API's 1-hour action window:
 * - before the scheduled time → "Available at 8:00 AM" (no buttons that would fail),
 * - within the window → Skip / Take, or Undo after acting,
 * - after the window → locked.
 * Buttons show a busy state while the request is in flight to prevent double submits.
 */
export function DoseRow({ d, date, onDose }: DoseRowProps) {
  const [busy, setBusy] = useState<DoseAction | null>(null);
  const window = doseWindow(date, d);
  const status = statusOf(d, window);
  const acted = d.status === "taken" || d.status === "skipped";

  /** Runs an action with a per-row busy flag. */
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
    <div className={`dose-row is-${d.status}`} data-window={window}>
      <div className={`dose-icon ${status.tone}`}>
        <MedicineFormIcon form={d.form} size={21} />
      </div>
      <div className="dose-main">
        <div className="dose-top">
          <div className="dose-title">
            <b>{d.medName}</b>
            <span className="muted">
              {[
                d.strength,
                d.withFood ? "with food" : "",
                d.liquid !== "No liquid needed" ? d.liquid : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          <time className="dose-time">{fmtTime(d.time)}</time>
        </div>
        <div className="dose-foot">
          <span className={`status-chip ${status.className}`}>
            {d.status === "taken" && <Check size={14} aria-hidden="true" />}
            {status.label}
            {d.actionedByName && acted ? ` by ${d.actionedByName}` : ""}
          </span>
          {window === "open" && !acted && (
            <div className="dose-actions">
              <button className="btn ghost sm" disabled={!!busy} onClick={() => run("skip")}>
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
            </div>
          )}
          {window === "open" && acted && (
            <button className="btn ghost sm" disabled={!!busy} onClick={() => run("undo")}>
              <RotateCcw size={15} aria-hidden="true" />
              {busy === "undo" ? "Undoing…" : "Undo"}
            </button>
          )}
          {window === "upcoming" && !acted && (
            <span className="dose-hint">
              <Clock3 size={14} aria-hidden="true" />
              Available at {fmtTime(d.time)}
            </span>
          )}
          {window === "locked" && !acted && (
            <span className="dose-hint">
              <Lock size={14} aria-hidden="true" />
              Locked after 1 hour
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
