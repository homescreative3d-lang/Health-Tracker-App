import { useState } from "react";
import { Plus, X, Clock3 } from "lucide-react";
import { fmtTime } from "../lib/dates";

export function TimePicker({
  times,
  onChange,
}: {
  times: string[];
  onChange: (times: string[]) => void;
}) {
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
  const addTime = () => {
    let h = hour % 12;
    if (period === "PM") h += 12;
    const value = `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    if (!times.includes(value)) onChange([...times, value].sort());
  };
  const removeTime = (value: string) => onChange(times.filter((t) => t !== value));
  return (
    <div className="time-picker">
      <div className="time-picker-controls">
        <div className="time-select">
          <span>Hour</span>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <span className="time-colon">:</span>
        <div className="time-select">
          <span>Minute</span>
          <select value={minute} onChange={(e) => setMinute(Number(e.target.value))}>
            {Array.from({ length: 60 }, (_, i) => i).map((v) => (
              <option key={v} value={v}>
                {String(v).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        <div className="time-select period-select">
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "AM" | "PM")}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <button type="button" className="btn soft time-add" onClick={addTime}>
          <Plus size={16} />
          Add time
        </button>
      </div>
      <div className="selected-times">
        {times.map((t) => (
          <span className="time-chip" key={t}>
            <Clock3 size={14} />
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
