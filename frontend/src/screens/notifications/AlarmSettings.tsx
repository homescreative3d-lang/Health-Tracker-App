import { useEffect, useRef, useState } from "react";
import { AlarmClock, Bell, BellRing, Music, Play, Square, Upload, Vibrate } from "lucide-react";
import {
  BUILT_IN_TONES,
  loadAlarmPrefs,
  saveAlarmPrefs,
  saveCustomSound,
  startAlarm,
  stopAlarm,
  unlockAudio,
  type AlarmPrefs,
} from "../../lib/alarmSound";
import type { AlertMode } from "../../hooks/useAlarms";

const MODES: { id: AlertMode; label: string; text: string; icon: typeof Bell }[] = [
  {
    id: "notification",
    label: "Notification",
    text: "A quiet alert in the bell and on the device",
    icon: Bell,
  },
  { id: "alarm", label: "Alarm", text: "Rings and vibrates until you act", icon: AlarmClock },
  { id: "both", label: "Both", text: "A notification plus a ringing alarm", icon: BellRing },
];

type AlarmSettingsProps = {
  /** Account-wide choice (saved with the other reminder settings). */
  mode: AlertMode;
  onModeChange: (m: AlertMode) => void;
};

/**
 * Choose how reminders arrive (notification, alarm or both) and set up this device's alarm:
 * built-in tone or your own sound, volume, vibration, and a test button. Alarms use the same
 * timing as notifications (first reminder, repeats, final alert).
 */
export function AlarmSettings({ mode, onModeChange }: AlarmSettingsProps) {
  const [prefs, setPrefs] = useState<AlarmPrefs>(loadAlarmPrefs);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;
  const alarmOn = mode !== "notification";

  /** Saves device preferences immediately. */
  const update = (patch: Partial<AlarmPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveAlarmPrefs(next);
    if (testing) void startAlarm(next);
  };

  useEffect(() => () => stopAlarm(), []);

  /** Plays/stops a test alarm (also unlocks sound for this session). */
  const test = async () => {
    if (testing) {
      stopAlarm();
      setTesting(false);
      return;
    }
    await unlockAudio();
    const ok = await startAlarm(prefs);
    setTesting(true);
    setMessage(
      ok ? "" : "Your browser blocked the sound. Tap Test again, and check the device isn't muted.",
    );
    window.setTimeout(() => {
      stopAlarm();
      setTesting(false);
    }, 8000);
  };

  /** Stores an uploaded sound on this device and selects it. */
  const upload = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    try {
      await saveCustomSound(f);
      update({ tone: "custom", customName: f.name });
      setMessage(`“${f.name}” saved on this device.`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <section className="card alarm-settings">
      <div className="section-heading">
        <div>
          <h3>How should reminders reach you?</h3>
          <p className="muted">
            Alarms follow the same timing as notifications: first reminder, repeats and the on-time
            alert.
          </p>
        </div>
      </div>
      <div className="mode-cards" role="radiogroup" aria-label="Reminder type">
        {MODES.map(({ id, label, text, icon: Icon }) => (
          <button
            type="button"
            role="radio"
            aria-checked={mode === id}
            key={id}
            className={mode === id ? "mode-card selected" : "mode-card"}
            onClick={() => onModeChange(id)}
          >
            <Icon size={22} aria-hidden="true" />
            <b>{label}</b>
            <small>{text}</small>
          </button>
        ))}
      </div>

      {alarmOn && (
        <div className="alarm-device">
          <h4>Alarm on this device</h4>
          <div className="field">
            <span className="field-label">
              <Music size={14} aria-hidden="true" /> Sound
            </span>
            <div className="chips">
              {BUILT_IN_TONES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  aria-pressed={prefs.tone === t.id}
                  className={prefs.tone === t.id ? "chip selected" : "chip"}
                  onClick={() => update({ tone: t.id })}
                >
                  {t.label}
                  {t.id === "chime" ? " (default)" : ""}
                </button>
              ))}
              {prefs.customName && (
                <button
                  type="button"
                  aria-pressed={prefs.tone === "custom"}
                  className={prefs.tone === "custom" ? "chip selected" : "chip"}
                  onClick={() => update({ tone: "custom" })}
                >
                  {prefs.customName}
                </button>
              )}
              <button type="button" className="chip" onClick={() => file.current?.click()}>
                <Upload size={13} aria-hidden="true" /> Use my own sound
              </button>
              <input
                ref={file}
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => void upload(e.currentTarget)}
              />
            </div>
          </div>
          <label className="field">
            <span className="field-label">Volume {Math.round(prefs.volume * 100)}%</span>
            <input
              className="range"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={prefs.volume}
              style={{ ["--v" as string]: `${((prefs.volume - 0.1) / 0.9) * 100}%` }}
              onChange={(e) => update({ volume: Number(e.target.value) })}
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              role="switch"
              checked={prefs.vibrate && canVibrate}
              disabled={!canVibrate}
              onChange={(e) => update({ vibrate: e.target.checked })}
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">
              <Vibrate size={14} aria-hidden="true" /> Vibrate
              {canVibrate ? "" : " (not supported on this device)"}
            </span>
          </label>
          <button type="button" className={testing ? "btn soft" : "btn primary"} onClick={test}>
            {testing ? (
              <Square size={16} aria-hidden="true" />
            ) : (
              <Play size={16} aria-hidden="true" />
            )}
            {testing ? "Stop test" : "Test alarm"}
          </button>
          {message && <p className="field-hint">{message}</p>}
          <div className="notice info">
            <AlarmClock size={18} aria-hidden="true" />
            <p>
              The alarm rings while Tended is open (even in a background tab). When the app is
              closed or the phone is locked, browsers only allow a notification: it vibrates
              strongly on Android and stays until you tap it. The Tended Android app can ring like a
              real alarm on a locked phone.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
