/**
 * Native (Android app) alarms: rings on a locked phone.
 *
 * Inside the Capacitor Android app, upcoming reminder slots are scheduled as local
 * notifications through Android's AlarmManager (`allowWhileIdle`), on a high-importance
 * channel with the chosen built-in tone and vibration, so they ring even when the app is
 * closed and the phone is asleep. In the browser these functions do nothing.
 */
import type { Dose } from "../api";
import { scheduledAt, today } from "./dates";
import type { AlertMode } from "../hooks/useAlarms";
import { loadAlarmPrefs } from "./alarmSound";

/** True when running inside the native app. */
export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Android channel per built-in tone (sound files live in android/app/src/main/res/raw). */
const CHANNELS: Record<string, { id: string; sound: string; name: string }> = {
  chime: {
    id: "tended-alarm-chime",
    sound: "tended_chime.wav",
    name: "Medicine alarm: Gentle chime",
  },
  beep: { id: "tended-alarm-beep", sound: "tended_beep.wav", name: "Medicine alarm: Classic beep" },
  bells: {
    id: "tended-alarm-bells",
    sound: "tended_bells.wav",
    name: "Medicine alarm: Bright bells",
  },
  pulse: {
    id: "tended-alarm-pulse",
    sound: "tended_pulse.wav",
    name: "Medicine alarm: Soft pulse",
  },
};

/** Stable numeric id per slot (Android notification ids are 32-bit ints). */
function slotId(doseId: string, at: number): number {
  let h = 0;
  for (const c of `${doseId}|${at}`) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

/**
 * Replaces all scheduled native alarms with the upcoming slots for today's pending doses.
 * Call after doses, settings or the alarm sound change.
 * @param doses - Today's doses (all patients the user acts for).
 * @param timing - Alert mode and reminder cadence.
 */
export async function syncNativeAlarms(
  doses: { dose: Dose; patientName: string }[],
  timing: {
    alertMode: AlertMode;
    leadMinutes: number;
    repeatMinutes: number;
    finalNotificationEnabled: boolean;
  },
): Promise<void> {
  if (!(await isNativeApp())) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const perm = await LocalNotifications.checkPermissions();
  if (
    perm.display !== "granted" &&
    (await LocalNotifications.requestPermissions()).display !== "granted"
  )
    return;

  const prefs = loadAlarmPrefs();
  const channel = CHANNELS[prefs.tone] || CHANNELS.chime;
  await LocalNotifications.createChannel({
    id: channel.id,
    name: channel.name,
    description: "Rings for medicine doses, even when the phone is locked",
    importance: 5,
    visibility: 1,
    sound: channel.sound,
    vibration: prefs.vibrate,
    lights: true,
    lightColor: "#0B7A6E",
  });
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: "TENDED_DOSE",
        actions: [
          { id: "taken", title: "Taken", foreground: true },
          { id: "snooze", title: "Snooze 5 min" },
        ],
      },
    ],
  });

  // Clear what we scheduled before, then schedule the next slots (max 60 to respect OS limits).
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length)
    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  if (timing.alertMode === "notification") return;

  const now = Date.now();
  const items: Parameters<typeof LocalNotifications.schedule>[0]["notifications"] = [];
  for (const { dose, patientName } of doses) {
    if (["taken", "skipped", "rescheduled"].includes(dose.status)) continue;
    const due = scheduledAt(dose.date || today(), dose.time).getTime();
    const slots: number[] = [];
    if (timing.leadMinutes > 0)
      for (
        let at = due - timing.leadMinutes * 60_000;
        at < due;
        at += Math.max(1, timing.repeatMinutes) * 60_000
      )
        slots.push(at);
    if (timing.finalNotificationEnabled || timing.leadMinutes === 0) slots.push(due);
    for (const at of slots.filter((a) => a > now)) {
      items.push({
        id: slotId(dose.id, at),
        title: `⏰ ${dose.medName}${dose.doseAmount ? `: take ${dose.doseAmount}` : ""}`,
        body: `${patientName ? patientName + " · " : ""}${at < due ? "Coming up at" : "Due now"} ${new Date(due).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
        schedule: { at: new Date(at), allowWhileIdle: true },
        channelId: channel.id,
        sound: channel.sound,
        actionTypeId: "TENDED_DOSE",
        extra: { doseId: dose.id },
        ongoing: false,
        autoCancel: true,
      });
    }
  }
  items.sort((a, b) => +a.schedule!.at! - +b.schedule!.at!);
  if (items.length) await LocalNotifications.schedule({ notifications: items.slice(0, 60) });
}
