import { useEffect, useState } from "react";
import { BellRing, Check, Send } from "lucide-react";
import { api, enablePush, type NotificationSettingsData } from "../../api";
import { err } from "../../lib/errors";
import { timeZones } from "../../constants/options";
import { Field } from "../../components/Field";

const DEFAULTS: NotificationSettingsData = {
  timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  leadMinutes: 15,
  repeatMinutes: 5,
  finalNotificationEnabled: true,
};

/**
 * Live preview of when reminders fire for a sample 8:00 PM dose, mirroring the server
 * scheduler: first reminder `lead` minutes before, repeats every `repeat` minutes until the
 * dose time, an optional final alert on time, and a missed-dose alert one hour after.
 */
function ReminderTimeline({
  lead,
  repeat,
  final,
}: {
  lead: number;
  repeat: number;
  final: boolean;
}) {
  const span = Math.max(lead, 15) + 60; // minutes shown: from first reminder to +60
  const start = -Math.max(lead, 15);
  const pos = (m: number) => ((m - start) / span) * 100;
  const reminders: number[] = [];
  if (lead > 0)
    for (let m = -lead; m < 0 && reminders.length < 40; m += Math.max(1, repeat)) reminders.push(m);
  const clock = (m: number) => {
    const t = 20 * 60 + m;
    const h = Math.floor((((t % 1440) + 1440) % 1440) / 60);
    return `${h % 12 || 12}:${String(((t % 60) + 60) % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  };
  return (
    <div className="reminder-timeline" aria-label="Reminder preview for a dose at 8:00 PM">
      <div className="rt-head">
        <b>Preview for a dose at 8:00 PM</b>
        <small>
          {reminders.length} reminder{reminders.length === 1 ? "" : "s"}
          {final ? " + on-time alert" : ""}
        </small>
      </div>
      <div className="rt-track">
        <span
          className="rt-window"
          style={{ left: `${pos(0)}%`, width: `${pos(60) - pos(0)}%` }}
          title="Take/Skip window"
        />
        {reminders.map((m, i) => (
          <span
            key={m}
            className="rt-mark reminder"
            style={{ left: `${pos(m)}%`, ["--i" as string]: i }}
            title={`Reminder at ${clock(m)}`}
          />
        ))}
        <span
          className={final ? "rt-mark dose final" : "rt-mark dose"}
          style={{ left: `${pos(0)}%` }}
          title="Dose time"
        />
        <span
          className="rt-mark missed"
          style={{ left: `${pos(60)}%` }}
          title="Missed-dose alert"
        />
      </div>
      <div className="rt-labels">
        <span style={{ left: `${pos(reminders[0] ?? 0)}%` }}>{clock(reminders[0] ?? 0)}</span>
        <span style={{ left: `${pos(0)}%` }}>8:00 PM</span>
        <span style={{ left: `${pos(60)}%` }}>9:00 PM</span>
      </div>
      <ul className="rt-legend">
        <li className="reminder">Reminder</li>
        <li className="dose">{final ? "On-time alert" : "Dose time"}</li>
        <li className="window">Take / Skip window</li>
        <li className="missed">Missed alert</li>
      </ul>
    </div>
  );
}

/** Resolves the VAPID public key from the API, falling back to the build-time env var. */
const vapidKey = (s: NotificationSettingsData) =>
  (s.vapidPublicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();

/**
 * Reminder timing settings plus device push setup.
 * Save, Enable and Test now have independent busy states (previously Save and Enable
 * shared one flag, so both buttons showed "Please wait…").
 */
export function NotificationSettings() {
  const [s, setS] = useState<NotificationSettingsData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState<"save" | "enable" | "test" | null>(null);
  const [saved, setSaved] = useState(false);
  const zones = timeZones.some((z) => z.id === s.timeZoneId)
    ? timeZones
    : [{ id: s.timeZoneId, label: s.timeZoneId }, ...timeZones];

  // Load saved settings once.
  useEffect(() => {
    let active = true;
    api
      .getNotificationSettings()
      .then((value) => active && setS(value))
      .catch((e) => active && setMsg({ text: err(e), error: true }))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  /**
   * Runs one of the three actions with its own busy flag and message handling.
   * @param kind - Which button was pressed.
   * @param fn - Action returning a success message.
   */
  const run = async (kind: "save" | "enable" | "test", fn: () => Promise<string>) => {
    setBusy(kind);
    setMsg(null);
    try {
      setMsg({ text: await fn() });
    } catch (e) {
      setMsg({ text: err(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  /** Saves timing settings after range validation. */
  const save = () =>
    run("save", async () => {
      if (s.leadMinutes < 0 || s.leadMinutes > 120)
        throw new Error("First reminder must be 0–120 minutes before.");
      if (s.repeatMinutes < 1 || s.repeatMinutes > 60)
        throw new Error("Repeat interval must be 1–60 minutes.");
      const updated = await api.saveNotificationSettings(s);
      setS((v) => ({ ...v, ...updated }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
      return "Notification settings saved.";
    });

  /** Requests browser permission and subscribes this device. */
  const enable = () =>
    run("enable", async () => {
      const key = vapidKey(s);
      if (!key)
        throw new Error(
          "Device alerts aren't configured on the server yet. Ask your administrator to add Web Push keys.",
        );
      await enablePush(key);
      return "This device will now receive alerts. Send a test to confirm.";
    });

  /** Sends a test push to every subscribed device. */
  const test = () =>
    run("test", async () => {
      if (!vapidKey(s)) throw new Error("Device alerts aren't configured on the server yet.");
      return (await api.testPush()).message || "Test notification sent.";
    });

  return (
    <section className="card notification-settings" aria-busy={!loaded}>
      <div className="section-heading">
        <div>
          <h3>Reminder timing</h3>
          <p className="muted">Applies to every patient you can see.</p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Time zone">
          <select
            className="input"
            value={s.timeZoneId}
            onChange={(e) => setS({ ...s, timeZoneId: e.target.value })}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`First reminder: ${s.leadMinutes ? `${s.leadMinutes} min before` : "off"}`}>
          <input
            className="range"
            type="range"
            min={0}
            max={120}
            step={5}
            value={s.leadMinutes}
            style={{ ["--v" as string]: `${(s.leadMinutes / 120) * 100}%` }}
            onChange={(e) => setS({ ...s, leadMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label={`Repeat every ${s.repeatMinutes} min`}>
          <input
            className="range"
            type="range"
            min={1}
            max={60}
            value={s.repeatMinutes}
            style={{ ["--v" as string]: `${((s.repeatMinutes - 1) / 59) * 100}%` }}
            onChange={(e) => setS({ ...s, repeatMinutes: Number(e.target.value) })}
          />
        </Field>
        <label className="check-row">
          <input
            type="checkbox"
            checked={s.finalNotificationEnabled}
            onChange={(e) => setS({ ...s, finalNotificationEnabled: e.target.checked })}
          />
          Send a final alert at the scheduled time
        </label>
      </div>
      <ReminderTimeline
        lead={s.leadMinutes}
        repeat={s.repeatMinutes}
        final={s.finalNotificationEnabled}
      />
      <div className="settings-actions">
        <button
          className={saved ? "btn primary is-saved" : "btn primary"}
          disabled={!!busy || !loaded}
          onClick={save}
        >
          {saved ? (
            <>
              <Check size={16} aria-hidden="true" /> Saved
            </>
          ) : busy === "save" ? (
            "Saving…"
          ) : (
            "Save settings"
          )}
        </button>
        <button className="btn soft" disabled={!!busy} onClick={enable}>
          <BellRing size={16} aria-hidden="true" />
          {busy === "enable" ? "Enabling…" : "Enable alerts on this device"}
        </button>
        <button className="btn ghost" disabled={!!busy} onClick={test}>
          <Send size={16} aria-hidden="true" />
          {busy === "test" ? "Sending…" : "Send test"}
        </button>
      </div>
      {msg && (
        <p
          className={msg.error ? "settings-message error" : "settings-message"}
          role={msg.error ? "alert" : "status"}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}
