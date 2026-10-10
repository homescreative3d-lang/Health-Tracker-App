import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { audiences } from "./landingContent";
import { AudienceArt } from "./Illustrations";

/** Accessible tabs (arrow keys move between tabs) describing who Tended is for. */
export function AudienceTabs() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const a = audiences[active];

  /** Selects and focuses a tab, wrapping around. */
  const select = (i: number) => {
    const next = (i + audiences.length) % audiences.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="audience">
      <div className="audience-tabs" role="tablist" aria-label="Who Tended is for">
        {audiences.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => (tabs.current[i] = el)}
            role="tab"
            id={`tab-${x.id}`}
            aria-controls={`panel-${x.id}`}
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            className={i === active ? "audience-tab active" : "audience-tab"}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") select(i + 1);
              if (e.key === "ArrowLeft") select(i - 1);
            }}
          >
            {x.tab}
          </button>
        ))}
      </div>
      <div
        className="audience-panel"
        role="tabpanel"
        id={`panel-${a.id}`}
        aria-labelledby={`tab-${a.id}`}
        key={a.id}
      >
        <div className="audience-copy">
          <h3>{a.title}</h3>
          <ul>
            {a.points.map((p) => (
              <li key={p}>
                <span className="audience-check" aria-hidden="true">
                  <Check size={14} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <AudienceArt id={a.id} />
      </div>
    </div>
  );
}
