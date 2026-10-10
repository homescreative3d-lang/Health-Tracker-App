import type { Dose } from "../api";
import { scheduledAt } from "./dates";

/**
 * Where a dose sits relative to the API's action window.
 *
 * The API only accepts Take/Skip/Undo between the scheduled time and one hour after it
 * (see `DoseService` on the backend). Showing the buttons outside that window produced
 * avoidable error toasts, so the UI now mirrors the rule. The server stays authoritative.
 */
export type DoseWindow = "upcoming" | "open" | "locked";

/** Length of the action window after the scheduled time, in minutes. */
export const ACTION_WINDOW_MINUTES = 60;

/**
 * Classifies a dose as upcoming (too early), open (actionable) or locked (window closed).
 * @param date - The date being viewed (`YYYY-MM-DD`); doses do not carry their own date.
 * @param dose - The dose to classify.
 * @param now - Current time (injectable for tests).
 */
export function doseWindow(date: string, dose: Pick<Dose, "time">, now = new Date()): DoseWindow {
  const at = scheduledAt(date, dose.time).getTime();
  if (now.getTime() < at) return "upcoming";
  if (now.getTime() > at + ACTION_WINDOW_MINUTES * 60_000) return "locked";
  return "open";
}
