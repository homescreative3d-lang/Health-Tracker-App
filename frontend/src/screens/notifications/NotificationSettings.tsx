import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api, enablePush, type Notification } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";

export function NotificationSettings() {
  const [s, setS] = useState<any>({
      timeZoneId: "Asia/Kolkata",
      leadMinutes: 15,
      repeatMinutes: 5,
      finalNotificationEnabled: true,
    }),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .getNotificationSettings()
      .then((value) => {
        if (active) setS(value);
      })
      .catch((e) => {
        if (active) setMsg(err(e));
      });
    return () => {
      active = false;
    };
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const updated = await api.saveNotificationSettings(s);
      setS((v: any) => ({ ...v, ...updated }));
      setMsg("Notification settings saved.");
    } catch (e) {
      setMsg(err(e));
    } finally {
      setBusy(false);
    }
  };
  const enable = async () => {
    setBusy(true);
    setMsg("");
    try {
      const key = (s.vapidPublicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
      if (!key)
        throw new Error(
          "The API has no VAPID public key configured. Add WebPush:PublicKey and WebPush:PrivateKey to the backend environment first.",
        );
      await enablePush(key);
      setMsg(
        "Browser permission granted and this device is subscribed. Send a test notification to verify delivery.",
      );
    } catch (e) {
      setMsg(err(e));
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setMsg("");
    try {
      if (!(s.vapidPublicKey || import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim()) {
        setMsg(
          "Browser push is not configured on the API. In Render, open the backend service Environment settings and add WebPush__PublicKey and WebPush__PrivateKey. Keep the private key server-side, then redeploy the API.",
        );
        return;
      }
      const result = await api.testPush();
      setMsg(result.message || "Test notification sent.");
    } catch (e) {
      setMsg(err(e));
    } finally {
      setTesting(false);
    }
  };
  return (
    <div className="card notification-settings">
      <div className="section-heading">
        <div>
          <span className="eyebrow">REMINDERS</span>
          <h3>Notification settings</h3>
          <p className="muted">Enable browser delivery, then send a test to confirm it works.</p>
        </div>
        <Bell />
      </div>
      <div className="form-grid">
        <Field label="Timezone">
          <select
            className="input"
            value={s.timeZoneId || "Asia/Kolkata"}
            onChange={(e) => setS({ ...s, timeZoneId: e.target.value })}
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
          </select>
        </Field>
        <Field label="First reminder (minutes before)">
          <input
            className="input"
            type="number"
            min="0"
            max="120"
            value={s.leadMinutes ?? 15}
            onChange={(e) => setS({ ...s, leadMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Repeat interval (minutes)">
          <input
            className="input"
            type="number"
            min="1"
            max="60"
            value={s.repeatMinutes ?? 5}
            onChange={(e) => setS({ ...s, repeatMinutes: Number(e.target.value) })}
          />
        </Field>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={!!s.finalNotificationEnabled}
          onChange={(e) => setS({ ...s, finalNotificationEnabled: e.target.checked })}
        />{" "}
        Final notification at scheduled time
      </label>
      <div className="settings-actions">
        <button className="btn primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save settings"}
        </button>
        <button className="btn soft" disabled={busy} onClick={enable}>
          {busy ? "Please wait…" : "Enable browser notifications"}
        </button>
        <button className="btn soft" disabled={testing} onClick={test}>
          {testing ? "Sending…" : "Send test notification"}
        </button>
      </div>
      {msg && (
        <p className="notification-settings-message" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
