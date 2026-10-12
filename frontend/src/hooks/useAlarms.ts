import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Dose, type Patient, type User } from "../api";
import { scheduledAt, today } from "../lib/dates";
import { syncNativeAlarms } from "../lib/nativeAlarms";

/** How reminders reach the user (account-wide, from notification settings). */
export type AlertMode = "notification" | "alarm" | "both";

/** An alarm that is ringing now. */
export type ActiveAlarm = { dose: Dose; patient: Patient; slot: number; kind: "before" | "due" };

type Timing = {
  alertMode: AlertMode;
  leadMinutes: number;
  repeatMinutes: number;
  finalNotificationEnabled: boolean;
};

const POLL_MS = 30_000;
/** A slot rings if we notice it within this window (covers sleeping tabs that wake late). */
const GRACE_MS = 3 * 60_000;
const FIRED_KEY = "tended.alarmsFired";

/** Ring times for one dose, mirroring the server's reminder cadence. */
function slotsFor(d: Dose, t: Timing): { at: number; kind: "before" | "due" }[] {
  const due = scheduledAt(d.date || today(), d.time).getTime();
  const out: { at: number; kind: "before" | "due" }[] = [];
  if (t.leadMinutes > 0) {
    const step = Math.max(1, t.repeatMinutes) * 60_000;
    for (let at = due - t.leadMinutes * 60_000; at < due; at += step)
      out.push({ at, kind: "before" });
  }
  if (t.finalNotificationEnabled || t.leadMinutes === 0) out.push({ at: due, kind: "due" });
  return out;
}

/**
 * In-app alarm scheduler. While Tended is open it rings for every pending dose of every patient
 * the user cares for, at the same cadence as reminders (first alert N minutes before, repeats
 * every M minutes, final alert on time). Push messages that arrive while the app is open ring too.
 * Stops as soon as anyone records the dose.
 *
 * @param user - Signed-in user (null when signed out).
 * @param patients - Patients the user can see.
 * @param canAct - Whether the user may take/skip doses for a patient.
 */
export function useAlarms(user: User | null, patients: Patient[], canAct: (p: Patient) => boolean) {
  const [timing, setTiming] = useState<Timing | null>(null);
  const [active, setActive] = useState<ActiveAlarm | null>(null);
  const snoozed = useRef(new Map<string, number>());
  const fired = useRef<Set<string>>(new Set(JSON.parse(sessionStorage.getItem(FIRED_KEY) || "[]")));
  const doses = useRef(new Map<string, { dose: Dose; patient: Patient }>());

  /** Reloads the user's alert mode and timing (also after settings are saved). */
  const loadTiming = useCallback(() => {
    if (!user) return;
    api
      .getNotificationSettings()
      .then((s) =>
        setTiming({
          alertMode: ((s as { alertMode?: AlertMode }).alertMode || "notification") as AlertMode,
          leadMinutes: s.leadMinutes,
          repeatMinutes: s.repeatMinutes,
          finalNotificationEnabled: s.finalNotificationEnabled,
        }),
      )
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    loadTiming();
    const onChange = () => loadTiming();
    window.addEventListener("tended:settings-changed", onChange);
    return () => window.removeEventListener("tended:settings-changed", onChange);
  }, [loadTiming]);

  const ringing = timing && timing.alertMode !== "notification";

  // Switching back to notifications clears alarms already scheduled on the phone (native app).
  useEffect(() => {
    if (timing?.alertMode === "notification") void syncNativeAlarms([], timing).catch(() => {});
  }, [timing]);

  /** Marks a slot as handled so it never rings twice in this session. */
  const markFired = (key: string) => {
    fired.current.add(key);
    sessionStorage.setItem(FIRED_KEY, JSON.stringify([...fired.current].slice(-300)));
  };

  // Poll today's doses for every patient and ring for due slots.
  useEffect(() => {
    if (!user || !ringing) return;
    let alive = true;
    const tick = async () => {
      const list = patients.filter((p) => p.id && canAct(p));
      const fresh = new Map<string, { dose: Dose; patient: Patient }>();
      for (const p of list) {
        try {
          for (const d of await api.getDoses(today(), p.id))
            fresh.set(d.id, { dose: d, patient: p });
        } catch {
          /* keep going */
        }
      }
      if (!alive) return;
      doses.current = fresh;
      // Inside the Android app, keep OS-level alarms in sync so they ring on a locked phone.
      void syncNativeAlarms(
        [...fresh.values()].map(({ dose, patient }) => ({
          dose,
          patientName: dose.patientName || patient.name,
        })),
        timing!,
      ).catch(() => {});
      // Stop if the ringing dose was recorded meanwhile (by anyone).
      setActive((cur) => {
        if (!cur) return cur;
        const now = fresh.get(cur.dose.id)?.dose;
        return !now ||
          now.status === "taken" ||
          now.status === "skipped" ||
          now.status === "rescheduled"
          ? null
          : cur;
      });
      const now = Date.now();
      for (const { dose, patient } of fresh.values()) {
        if (dose.status === "taken" || dose.status === "skipped" || dose.status === "rescheduled")
          continue;
        const slots = slotsFor(dose, timing!);
        const snooze = snoozed.current.get(dose.id);
        if (snooze) slots.push({ at: snooze, kind: "due" });
        for (const s of slots) {
          const key = `${dose.id}|${s.at}`;
          if (now >= s.at && now - s.at < GRACE_MS && !fired.current.has(key)) {
            markFired(key);
            setActive((cur) => cur || { dose, patient, slot: s.at, kind: s.kind });
          }
        }
      }
    };
    void tick();
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ringing, patients, timing]);

  // A push that arrives while the app is open (service worker message) rings immediately.
  useEffect(() => {
    if (!ringing || !("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; doseId?: string; alertMode?: string };
      if (data?.type !== "tended-alarm" || !data.doseId) return;
      const hit = doses.current.get(data.doseId);
      const key = `${data.doseId}|push|${Math.floor(Date.now() / 120_000)}`;
      if (hit && !fired.current.has(key)) {
        markFired(key);
        setActive(
          (cur) => cur || { dose: hit.dose, patient: hit.patient, slot: Date.now(), kind: "due" },
        );
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [ringing]);

  /** Rings again in 5 minutes. */
  const snooze = () => {
    if (!active) return;
    snoozed.current.set(active.dose.id, Date.now() + 5 * 60_000);
    setActive(null);
  };

  return {
    active,
    dismiss: () => setActive(null),
    snooze,
    alertMode: timing?.alertMode || "notification",
    reloadTiming: loadTiming,
  };
}
