import { CalendarDays, Clock3 } from "lucide-react";
import { type Dose, type Medicine } from "../../api";
import { today, addDays, fmtTime, dateLabel } from "../../lib/dates";
import { days } from "../../constants/options";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";

export function Calendar({
  selectedDate,
  setSelectedDate,
  grouped,
  meds,
  onPause,
}: {
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  grouped: { name: string; items: Dose[] }[];
  meds: Medicine[];
  onPause: (id: string, start: string) => Promise<void>;
}) {
  const days = Array.from({ length: 21 }, (_, i) => addDays(today(), i - 7));
  const total = grouped.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <span className="eyebrow">PLAN AHEAD</span>
          <h1>Medication calendar</h1>
          <p className="muted">Choose a day to see scheduled doses.</p>
        </div>
        <label className="calendar-picker">
          <CalendarDays />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>
      <div className="calendar-strip">
        {days.map((d) => (
          <button
            key={d}
            className={d === selectedDate ? "calendar-day active" : "calendar-day"}
            onClick={() => setSelectedDate(d)}
          >
            <span>
              {new Date(d + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "short",
              })}
            </span>
            <b>{new Date(d + "T00:00:00").getDate()}</b>
          </button>
        ))}
      </div>
      <div className="pause-panel card">
        <div className="pause-panel-copy">
          <span className="pause-panel-icon">
            <Clock3 size={19} />
          </span>
          <div>
            <b>Pause a medicine</b>
            <p className="muted">Pause future doses starting {dateLabel(selectedDate)}.</p>
          </div>
        </div>
        <div className="pause-controls">
          <select
            className="input"
            id="pause-med"
            aria-label="Medicine to pause"
            disabled={!meds.length}
          >
            <option value="">Choose medicine</option>
            {meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            className="btn soft"
            disabled={!meds.length}
            onClick={() => {
              const el = document.getElementById("pause-med") as HTMLSelectElement | null;
              if (el && el.value) onPause(el.value, selectedDate);
            }}
          >
            <Clock3 size={16} />
            Pause from selected date
          </button>
        </div>
      </div>
      <div className="calendar-summary">
        <div>
          <span className="muted">{dateLabel(selectedDate)}</span>
          <strong>
            {total} scheduled dose{total !== 1 ? "s" : ""}
          </strong>
        </div>
        <Clock3 />
      </div>
      {grouped.map(
        (g) =>
          g.items.length > 0 && (
            <div className="dose-group" key={g.name}>
              <h4>{g.name}</h4>
              <div className="card dose-card">
                {g.items.map((d) => (
                  <div className="calendar-dose" key={d.id}>
                    <div className="dose-icon">
                      <MedicineFormIcon form={d.form} size={19} />
                    </div>
                    <div>
                      <b>{d.medName}</b>
                      <span className="muted">
                        {d.strength} · {fmtTime(d.time)}
                      </span>
                    </div>
                    <span
                      className={
                        d.status === "taken"
                          ? "status-success"
                          : d.status === "skipped"
                            ? "status-danger"
                            : "status-pending"
                      }
                    >
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ),
      )}
      {total === 0 && (
        <div className="card empty-card compact">
          <CalendarDays />
          <b>No doses planned for this day</b>
          <span className="muted">Try another date or add a medicine.</span>
        </div>
      )}
    </div>
  );
}
