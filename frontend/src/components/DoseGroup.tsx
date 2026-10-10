import type { ReactNode } from "react";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import type { DayPart } from "../lib/dates";

const ICONS = { Morning: Sunrise, Afternoon: Sun, Evening: Sunset, Night: Moon };

/**
 * A daypart compartment (Morning / Afternoon / Evening / Night), styled after the
 * color-coded compartments of a weekly pill organizer so caregivers can scan the day.
 */
export function DoseGroup({
  name,
  count,
  children,
}: {
  name: DayPart;
  count: number;
  children: ReactNode;
}) {
  const Icon = ICONS[name];
  return (
    <section className={`dose-group part-${name.toLowerCase()}`} aria-label={`${name} doses`}>
      <h4>
        <Icon size={16} aria-hidden="true" />
        {name}
        <span className="dose-group-count">{count}</span>
      </h4>
      <div className="card dose-card">{children}</div>
    </section>
  );
}
