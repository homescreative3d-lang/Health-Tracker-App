import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, PauseCircle } from "lucide-react";
import type { Dose, Medicine } from "../../api";
import { addDays, dateLabel, parseLocalDate, today, type DayPart } from "../../lib/dates";
import { plural } from "../../lib/text";
import { isPausedOn } from "../../constants/options";
import { DoseGroup } from "../../components/DoseGroup";
import { DoseRow, type DoseAction } from "../../components/DoseRow";
import { PageHeader } from "../../components/PageHeader";

type CalendarProps = {
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  grouped: { name: DayPart; items: Dose[] }[];
  meds: Medicine[];
  onPause: (id: string, start: string) => Promise<void>;
  onDose: (d: Dose, a: DoseAction) => Promise<void>;
};

/**
 * Plan-ahead view: a scrollable 3-week day strip, a date picker for any other day,
 * the doses scheduled on the chosen day, and a control to pause a medicine from that day.
 */
export function Calendar({
  selectedDate,
  setSelectedDate,
  grouped,
  meds,
  onPause,
  onDose,
}: CalendarProps) {
  const [pauseId, setPauseId] = useState("");
  const [pausing, setPausing] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  // Center the strip on the selected date (falls back to today when picking a far date).
  const anchor =
    Math.abs(parseLocalDate(selectedDate).getTime() - parseLocalDate(today()).getTime()) <
    10 * 864e5
      ? today()
      : selectedDate;
  const days = Array.from({ length: 21 }, (_, i) => addDays(anchor, i - 7));
  const total = grouped.reduce((n, g) => n + g.items.length, 0);
  const pausable = meds.filter((m) => !isPausedOn(m, selectedDate));

  // Keep the active day visible in the horizontally scrolling strip.
  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>(".calendar-day.active")
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selectedDate]);

  /** Pauses the chosen medicine from the selected date. */
  const pause = async () => {
    if (!pauseId) return;
    setPausing(true);
    try {
      await onPause(pauseId, selectedDate);
      setPauseId("");
    } finally {
      setPausing(false);
    }
  };

  return (
    <div className="page-scroll">
      <PageHeader
        kicker="Plan ahead"
        title="Calendar"
        description="Choose a day to see what's scheduled."
        actions={
          <label className="calendar-picker btn soft">
            <CalendarDays size={17} aria-hidden="true" />
            <span className="sr-only">Pick a date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            />
          </label>
        }
      />
      <div className="calendar-nav">
        <button
          className="icon-btn"
          aria-label="Previous day"
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="calendar-strip" ref={stripRef} role="listbox" aria-label="Days">
          {days.map((d) => {
            const date = parseLocalDate(d);
            return (
              <button
                key={d}
                role="option"
                aria-selected={d === selectedDate}
                className={[
                  "calendar-day",
                  d === selectedDate ? "active" : "",
                  d === today() ? "is-today" : "",
                ].join(" ")}
                onClick={() => setSelectedDate(d)}
              >
                <span>{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                <b>{date.getDate()}</b>
              </button>
            );
          })}
        </div>
        <button
          className="icon-btn"
          aria-label="Next day"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-summary">
        <div>
          <span className="muted">{dateLabel(selectedDate)}</span>
          <strong>{plural(total, "scheduled dose")}</strong>
        </div>
        {selectedDate !== today() && (
          <button className="btn ghost sm" onClick={() => setSelectedDate(today())}>
            Back to today
          </button>
        )}
      </div>

      {grouped.map(
        (g) =>
          g.items.length > 0 && (
            <DoseGroup key={g.name} name={g.name} count={g.items.length}>
              {g.items.map((d) => (
                <DoseRow d={d} key={d.id} date={selectedDate} onDose={onDose} />
              ))}
            </DoseGroup>
          ),
      )}
      {total === 0 && (
        <div className="card empty-card compact">
          <CalendarDays aria-hidden="true" />
          <b>No doses planned for this day</b>
          <span className="muted">
            Pick another date, or add a medicine from the Medicines tab.
          </span>
        </div>
      )}

      <div className="pause-panel card">
        <div className="pause-panel-copy">
          <span className="pause-panel-icon">
            <PauseCircle size={20} aria-hidden="true" />
          </span>
          <div>
            <b>Pause a medicine</b>
            <p className="muted">
              Stops doses from {selectedDate === today() ? "today" : dateLabel(selectedDate)} until
              you resume it from Medicines.
            </p>
          </div>
        </div>
        <div className="pause-controls">
          <select
            className="input"
            aria-label="Medicine to pause"
            value={pauseId}
            onChange={(e) => setPauseId(e.target.value)}
            disabled={!pausable.length}
          >
            <option value="">{pausable.length ? "Choose medicine" : "No active medicines"}</option>
            {pausable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="btn soft" disabled={!pauseId || pausing} onClick={pause}>
            {pausing ? "Pausing…" : "Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}
