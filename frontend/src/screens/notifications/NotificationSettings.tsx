import { useEffect, useState } from "react";
import { BellRing, Send } from "lucide-react";
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
        <Field label="First reminder (minutes before)">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={s.leadMinutes}
            onChange={(e) => setS({ ...s, leadMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Repeat every (minutes)">
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={s.repeatMinutes}
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
      <div className="settings-actions">
        <button className="btn primary" disabled={!!busy || !loaded} onClick={save}>
          {busy === "save" ? "Saving…" : "Save settings"}
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
