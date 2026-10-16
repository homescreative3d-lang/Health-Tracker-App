import type { Dose } from "../api";
import { scheduledAt } from "./dates";

/**
 * Where a dose sits relative to the API's action window.
 *
 * A dose can be taken/skipped (or undone) from its scheduled time until the action window closes:
 * 12 hours by default, configurable on the server (`doses.actionWindowHours`, sent in
 * GET /api/features). After one hour without a record it is shown as late. The server stays authoritative.
 */
export type DoseWindow = "upcoming" | "open" | "late" | "locked";

/** Minutes after the scheduled time a dose counts as late (still recordable). */
export const LATE_AFTER_MINUTES = 60;

let windowMinutes = 12 * 60;

/** Sets the action window from the server value (hours). */
export function setDoseWindowHours(hours: number | undefined) {
  if (hours && hours > 0) windowMinutes = Math.round(hours * 60);
}

/** Current action window in hours (for messages). */
export const doseWindowHours = () => windowMinutes / 60;

/** When the window for a dose closes. */
export function windowClosesAt(date: string, dose: Pick<Dose, "time">): Date {
  return new Date(scheduledAt(date, dose.time).getTime() + windowMinutes * 60_000);
}

/**
 * Classifies a dose: upcoming (too early), open (first hour), late (still recordable) or locked
 * (window closed).
 * @param date - The date being viewed (`YYYY-MM-DD`).
 * @param dose - The dose to classify.
 * @param now - Current time (injectable for tests).
 */
export function doseWindow(date: string, dose: Pick<Dose, "time">, now = new Date()): DoseWindow {
  const at = scheduledAt(date, dose.time).getTime();
  const t = now.getTime();
  if (t < at) return "upcoming";
  if (t > at + windowMinutes * 60_000) return "locked";
  if (t > at + LATE_AFTER_MINUTES * 60_000) return "late";
  return "open";
}
