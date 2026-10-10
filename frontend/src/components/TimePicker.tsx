import { useState } from "react";
import { Clock3, Plus, X } from "lucide-react";
import { fmtTime } from "../lib/dates";

type TimePickerProps = {
  /** Selected times (`HH:mm`). */
  times: string[];
  /** Receives the updated, de-duplicated, sorted list. */
  onChange: (times: string[]) => void;
  /** Allow only one time (used when moving a single dose). */
  single?: boolean;
};

/**
 * Picks dose times with 12-hour selects. Nothing is pre-selected: the user chooses hour,
 * minute and AM/PM, then adds the time (there is no default such as 8:00).
 */
export function TimePicker({ times, onChange, single = false }: TimePickerProps) {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [period, setPeriod] = useState<"" | "AM" | "PM">("");
  const ready = hour !== "" && minute !== "" && period !== "";

  /** Builds `HH:mm` from the selects and adds it (replacing it when `single`). */
  const addTime = () => {
    if (!ready) return;
    let h = Number(hour) % 12;
    if (period === "PM") h += 12;
    const value = `${String(h).padStart(2, "0")}:${minute}`;
    if (single) onChange([value]);
    else if (!times.includes(value)) onChange([...times, value].sort());
    setHour("");
    setMinute("");
    setPeriod("");
  };

  /** Removes a time from the list. */
  const removeTime = (value: string) => onChange(times.filter((t) => t !== value));

  return (
    <div className="time-picker">
      <div className="time-picker-controls">
        <label className="time-select">
          <span>Hour</span>
          <select value={hour} onChange={(e) => setHour(e.target.value)}>
            <option value="">--</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <span className="time-colon">:</span>
        <label className="time-select">
          <span>Minute</span>
          <select value={minute} onChange={(e) => setMinute(e.target.value)}>
            <option value="">--</option>
            {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="time-select period-select">
          <span>AM/PM</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "" | "AM" | "PM")}>
            <option value="">--</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <button type="button" className="btn soft time-add" onClick={addTime} disabled={!ready}>
          <Plus size={16} aria-hidden="true" />
          {single ? "Set time" : "Add time"}
        </button>
      </div>
      {times.length > 0 ? (
        <div className="selected-times">
          {times.map((t) => (
            <span className="time-chip" key={t}>
              <Clock3 size={14} aria-hidden="true" />
              {fmtTime(t)}
              <button
                type="button"
                onClick={() => removeTime(t)}
                aria-label={`Remove ${fmtTime(t)}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <small className="field-hint time-empty">
          No time chosen yet. Pick the hour, minute and AM/PM, then add it.
        </small>
      )}
    </div>
  );
}
