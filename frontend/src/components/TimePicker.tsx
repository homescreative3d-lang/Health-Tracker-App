import { useState } from "react";
import { Clock3, Plus, X } from "lucide-react";
import { fmtTime } from "../lib/dates";

/**
 * Picks one or more dose times using 12-hour selects (friendlier than native time inputs
 * on older Android browsers). Times are emitted sorted in 24-hour `HH:mm` format.
 * @param times - Selected times.
 * @param onChange - Receives the updated, de-duplicated, sorted list.
 */
export function TimePicker({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
  /** Splits `HH:mm` into 12-hour parts for the selects. */
  const toParts = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return {
      hour: h % 12 || 12,
      minute: m,
      period: (h >= 12 ? "PM" : "AM") as "AM" | "PM",
    };
  };
  const first = toParts(times[0] || "08:00");
  const [hour, setHour] = useState(first.hour),
    [minute, setMinute] = useState(first.minute),
    [period, setPeriod] = useState<"AM" | "PM">(first.period);
  /** Adds the currently selected time if it isn't already in the list. */
  const addTime = () => {
    let h = hour % 12;
    if (period === "PM") h += 12;
    const value = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (!times.includes(value)) onChange([...times, value].sort());
  };
  /** Removes a time from the list. */
  const removeTime = (value: string) => onChange(times.filter((t) => t !== value));
  return (
    <div className="time-picker">
      <div className="time-picker-controls">
        <label className="time-select">
          <span>Hour</span>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
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
          <select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>
            {Array.from({ length: 60 }, (_, i) => i).map((v) => (
              <option key={v} value={v}>
                {String(v).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label className="time-select period-select">
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "AM" | "PM")}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
        <button type="button" className="btn soft time-add" onClick={addTime}>
          <Plus size={16} aria-hidden="true" />
          Add time
        </button>
      </div>
      <div className="selected-times">
        {times.map((t) => (
          <span className="time-chip" key={t}>
            <Clock3 size={14} aria-hidden="true" />
            {fmtTime(t)}
            <button type="button" onClick={() => removeTime(t)} aria-label={`Remove ${fmtTime(t)}`}>
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <small className="field-hint">
        Choose the hour, minute and AM/PM. Add each dose time separately.
      </small>
    </div>
  );
}
