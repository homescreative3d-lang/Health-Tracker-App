import { useState } from "react";
import type React from "react";
import { Check, Moon, RotateCcw, Sun, Sunrise, Sunset } from "lucide-react";

type Slot = { part: "Morning" | "Afternoon" | "Evening" | "Night"; med: string; time: string };

const SLOTS: Slot[] = [
  { part: "Morning", med: "Metformin 500 mg", time: "8:00 AM" },
  { part: "Afternoon", med: "Vitamin D3", time: "1:00 PM" },
  { part: "Evening", med: "Amlodipine 5 mg", time: "7:00 PM" },
  { part: "Night", med: "Insulin 10 units", time: "9:30 PM" },
];
const ICON = { Morning: Sunrise, Afternoon: Sun, Evening: Sunset, Night: Moon };

/**
 * Playable demo: a pill organizer where visitors tap each compartment to "take" a dose
 * and watch the adherence ring fill. Purely local state — nothing is saved or sent.
 */
export function TryItDemo({ onSignup }: { onSignup: () => void }) {
  const [taken, setTaken] = useState<boolean[]>([false, false, false, false]);
  const count = taken.filter(Boolean).length;
  const pct = Math.round((count / SLOTS.length) * 100);
  const done = count === SLOTS.length;

  /** Toggles one compartment. */
  const toggle = (i: number) => setTaken((t) => t.map((v, j) => (j === i ? !v : v)));

  return (
    <div className={done ? "try-demo is-done" : "try-demo"}>
      <div className="try-organizer" role="group" aria-label="Sample pill organizer">
        {SLOTS.map((s, i) => {
          const Icon = ICON[s.part];
          return (
            <button
              key={s.part}
              className={`try-slot part-${s.part.toLowerCase()} ${taken[i] ? "is-taken" : ""}`}
              aria-pressed={taken[i]}
              onClick={() => toggle(i)}
            >
              <span className="try-slot-head">
                <Icon size={16} aria-hidden="true" />
                {s.part}
              </span>
              <span className="try-pill" aria-hidden="true">
                <span />
              </span>
              <span className="try-slot-med">{s.med}</span>
              <span className="try-slot-time">{s.time}</span>
              <span className="try-slot-action">
                {taken[i] ? (
                  <>
                    <Check size={14} aria-hidden="true" /> Taken
                  </>
                ) : (
                  "Tap to take"
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="try-side">
        <div
          className="try-ring"
          style={{ "--p": pct } as React.CSSProperties}
          role="img"
          aria-label={`${pct}% of today's doses taken`}
        >
          <span>
            <b>{pct}%</b>
            <small>today</small>
          </span>
        </div>
        <p className="try-status" aria-live="polite">
          {done
            ? "All four doses taken. That's a perfect day."
            : `${count} of ${SLOTS.length} doses taken`}
        </p>
        {done && (
          <div className="try-burst" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--i": i } as React.CSSProperties} />
            ))}
          </div>
        )}
        <div className="try-actions">
          <button
            className="btn soft sm"
            onClick={() => setTaken([false, false, false, false])}
            disabled={!count}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Reset
          </button>
          {done && (
            <button className="btn primary sm" onClick={onSignup}>
              Start your real plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
