/**
 * Alarm audio + vibration for the in-app alarm.
 *
 * - Built-in tones are synthesized with the Web Audio API (original, no licensed audio files).
 * - A custom sound chosen by the user is stored on this device only (IndexedDB) and looped.
 * - Browsers only allow sound after the user has interacted with the page once; `unlockAudio()`
 *   is called from a tap (e.g. "Allow alarm sound on this device").
 * - Vibration uses navigator.vibrate where supported (Android browsers; not iPhone).
 */

/** Built-in tone ids and labels. */
export const BUILT_IN_TONES = [
  { id: "chime", label: "Gentle chime" },
  { id: "beep", label: "Classic beep" },
  { id: "bells", label: "Bright bells" },
  { id: "pulse", label: "Soft pulse" },
] as const;
export type ToneId = (typeof BUILT_IN_TONES)[number]["id"] | "custom";

/** Device-level alarm preferences (kept in localStorage; sound choice differs per device). */
export type AlarmPrefs = { tone: ToneId; volume: number; vibrate: boolean; customName?: string };
const PREFS_KEY = "tended.alarmPrefs";
export const DEFAULT_PREFS: AlarmPrefs = { tone: "chime", volume: 0.8, vibrate: true };

/** Reads this device's alarm preferences. */
export function loadAlarmPrefs(): AlarmPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Saves this device's alarm preferences. */
export function saveAlarmPrefs(p: AlarmPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ---------- Custom sound storage (IndexedDB, this device only) ----------
const DB = "tended-alarm";
const STORE = "sounds";

/** Opens the small IndexedDB used for the custom sound. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Stores the user's custom alarm sound (max 2 MB audio). */
export async function saveCustomSound(file: File): Promise<void> {
  if (!file.type.startsWith("audio/"))
    throw new Error("Choose an audio file (MP3, M4A, OGG or WAV).");
  if (file.size > 2 * 1024 * 1024) throw new Error("The sound must be 2 MB or smaller.");
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, "custom");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Loads the custom sound, or null. */
async function loadCustomSound(): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get("custom");
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ---------- Playback ----------
let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;
let vibrateTimer: number | null = null;

/** True once audio has been unlocked by a user gesture in this session. */
export const audioUnlocked = () => !!ctx && ctx.state === "running";

/** Creates/resumes the AudioContext. Must be called from a user gesture (tap/click). */
export async function unlockAudio(): Promise<boolean> {
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== "running") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

/** Plays one note of a synthesized tone. */
function note(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
) {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(1, start + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Note patterns for the built-in tones (frequency Hz, offset s, duration s), one cycle each. */
const PATTERNS: Record<
  Exclude<ToneId, "custom">,
  { notes: [number, number, number][]; type: OscillatorType; cycle: number }
> = {
  chime: {
    notes: [
      [880, 0, 0.9],
      [1318.5, 0.25, 0.9],
      [1046.5, 0.5, 1.2],
    ],
    type: "sine",
    cycle: 2.2,
  },
  beep: {
    notes: [
      [1000, 0, 0.12],
      [1000, 0.2, 0.12],
      [1000, 0.4, 0.12],
      [1000, 0.6, 0.12],
    ],
    type: "square",
    cycle: 1.4,
  },
  bells: {
    notes: [
      [1568, 0, 0.5],
      [1975.5, 0.15, 0.5],
      [2349.3, 0.3, 0.7],
      [1975.5, 0.6, 0.5],
    ],
    type: "triangle",
    cycle: 1.8,
  },
  pulse: {
    notes: [
      [523.3, 0, 0.6],
      [659.3, 0.7, 0.6],
    ],
    type: "sine",
    cycle: 2.0,
  },
};

/** Starts the vibration loop (if enabled and supported). */
function startVibration() {
  if (!("vibrate" in navigator)) return;
  const pulse = () => navigator.vibrate([600, 250, 600, 250, 900]);
  pulse();
  vibrateTimer = window.setInterval(pulse, 3200);
}

/**
 * Starts ringing until `stopAlarm()` is called.
 * @param prefs - Tone, volume and vibration settings.
 * @returns False if audio couldn't start (not unlocked yet); vibration may still run.
 */
export async function startAlarm(prefs: AlarmPrefs = loadAlarmPrefs()): Promise<boolean> {
  stopAlarm();
  if (prefs.vibrate) startVibration();
  if (prefs.tone === "custom") {
    const blob = await loadCustomSound();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = Math.min(1, Math.max(0, prefs.volume));
      try {
        await audio.play();
        stopFn = () => {
          audio.pause();
          URL.revokeObjectURL(url);
        };
        return true;
      } catch {
        URL.revokeObjectURL(url);
        // fall back to the default tone below
      }
    }
  }
  if (!ctx || ctx.state !== "running") {
    if (!(await unlockAudio())) return false;
  }
  const ac = ctx!;
  const master = ac.createGain();
  master.gain.value = Math.min(1, Math.max(0, prefs.volume)) * 0.35;
  master.connect(ac.destination);
  const p = PATTERNS[prefs.tone === "custom" ? "chime" : prefs.tone];
  let next = ac.currentTime + 0.05;
  // Schedule cycles slightly ahead so the loop never stutters.
  const schedule = () => {
    while (next < ac.currentTime + 2) {
      for (const [f, off, dur] of p.notes) note(ac, master, f, next + off, dur, p.type);
      next += p.cycle;
    }
  };
  schedule();
  const timer = window.setInterval(schedule, 500);
  stopFn = () => {
    window.clearInterval(timer);
    master.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    window.setTimeout(() => master.disconnect(), 300);
  };
  return true;
}

/** Stops sound and vibration. */
export function stopAlarm() {
  stopFn?.();
  stopFn = null;
  if (vibrateTimer !== null) {
    window.clearInterval(vibrateTimer);
    vibrateTimer = null;
  }
  if ("vibrate" in navigator) navigator.vibrate(0);
}
