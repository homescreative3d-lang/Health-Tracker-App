import { useEffect, useState } from "react";
import { AlarmClock, BellOff, Check, Volume2, X } from "lucide-react";
import type { ActiveAlarm } from "../hooks/useAlarms";
import { fmtTime } from "../lib/dates";
import { loadAlarmPrefs, startAlarm, stopAlarm, unlockAudio } from "../lib/alarmSound";
import { MedicineArt } from "./art/MedicineArt";

type AlarmOverlayProps = {
  alarm: ActiveAlarm;
  /** Take or skip the dose; resolves when recorded. */
  onAct: (action: "taken" | "skip") => Promise<void>;
  onSnooze: () => void;
  onDismiss: () => void;
};

/**
 * Full-screen alarm: rings (chosen tone, looped) and vibrates until the user acts.
 * Take is offered once the dose is due (from its scheduled time until the action window closes); before that it's a heads-up.
 */
export function AlarmOverlay({ alarm, onAct, onSnooze, onDismiss }: AlarmOverlayProps) {
  const [needsTap, setNeedsTap] = useState(false);
  const [busy, setBusy] = useState(false);
  const due = Date.now() >= new Date(`${alarm.dose.date}T${alarm.dose.time}:00`).getTime() - 60_000;

  useEffect(() => {
    let cancelled = false;
    void startAlarm(loadAlarmPrefs()).then((ok) => !cancelled && setNeedsTap(!ok));
    // Flash the tab title so the alarm is noticed in a background tab.
    const original = document.title;
    let on = false;
    const t = window.setInterval(() => {
      document.title = (on = !on) ? `⏰ ${alarm.dose.medName}` : original;
    }, 1000);
    return () => {
      cancelled = true;
      stopAlarm();
      window.clearInterval(t);
      document.title = original;
    };
  }, [alarm]);

  /** Records the action, then closes. */
  const act = async (action: "taken" | "skip") => {
    setBusy(true);
    try {
      await onAct(action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="alarm-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-title"
    >
      <div className="alarm-card">
        <div className="alarm-rings" aria-hidden="true">
          <span />
          <span />
          <span />
          <AlarmClock size={34} />
        </div>
        <span className="eyebrow">
          {due ? "Time for a dose" : `Coming up at ${fmtTime(alarm.dose.time)}`}
        </span>
        <h2 id="alarm-title">
          <MedicineArt form={alarm.dose.form} size={44} /> {alarm.dose.medName}
        </h2>
        <p className="alarm-sub">
          {alarm.dose.patientName || alarm.patient.name
            ? `${alarm.dose.patientName || alarm.patient.name} · `
            : ""}
          {alarm.dose.doseAmount ? `Take ${alarm.dose.doseAmount}` : alarm.dose.strength} ·{" "}
          {fmtTime(alarm.dose.time)}
          {alarm.dose.withFood ? " · with food" : ""}
        </p>
        {needsTap && (
          <button
            type="button"
            className="btn light alarm-sound"
            onClick={async () => {
              await unlockAudio();
              setNeedsTap(!(await startAlarm(loadAlarmPrefs())));
            }}
          >
            <Volume2 size={16} aria-hidden="true" /> Tap to turn on the alarm sound
          </button>
        )}
        <div className="alarm-actions">
          {due ? (
            <>
              <button
                type="button"
                className="btn alarm-take"
                disabled={busy}
                onClick={() => act("taken")}
              >
                <Check size={18} aria-hidden="true" /> {busy ? "Saving…" : "Taken"}
              </button>
              <button
                type="button"
                className="btn alarm-secondary"
                disabled={busy}
                onClick={() => act("skip")}
              >
                <X size={16} aria-hidden="true" /> Skip
              </button>
            </>
          ) : (
            <button type="button" className="btn alarm-take" onClick={onDismiss}>
              <Check size={18} aria-hidden="true" /> Got it
            </button>
          )}
          <button type="button" className="btn alarm-secondary" onClick={onSnooze}>
            Snooze 5 min
          </button>
          <button type="button" className="btn alarm-ghost" onClick={onDismiss}>
            <BellOff size={16} aria-hidden="true" /> Stop alarm
          </button>
        </div>
      </div>
    </div>
  );
}
