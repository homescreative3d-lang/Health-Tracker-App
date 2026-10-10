import type { MedicineInput } from "../api";
import { today } from "../lib/dates";

/** Conditions offered in pickers. "Other" lets users track medicines for unlisted conditions. */
export const conditions = [
  "Type 2 diabetes",
  "Type 1 diabetes",
  "Hypertension (high blood pressure)",
  "High cholesterol",
  "Asthma",
  "COPD",
  "Chronic kidney disease",
  "Osteoarthritis",
  "Depression",
  "Anxiety disorder",
  "Hypothyroidism",
  "GERD / acid reflux",
  "Chronic pain",
  "Other",
];

/** Caregiver-to-patient relationships. */
export const relationships = [
  "Parent",
  "Spouse",
  "Child",
  "Sibling",
  "Grandparent",
  "Relative",
  "Friend",
  "Professional caregiver",
  "Other",
];

/** Medicine forms (drives the icon shown on dose rows). */
export const forms = ["Pill", "Injection", "Syrup", "Drops", "Inhaler", "Powder", "Other"];

/** Weekday codes accepted by the API for `specificDays` schedules. */
export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Liquids a medicine can be taken with. */
export const liquids = ["No liquid needed", "Lukewarm water", "Milk", "Juice"];

/** Time zones offered in notification settings. */
export const timeZones = [
  { id: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "America/New_York" },
  { id: "Europe/London", label: "Europe/London" },
];

/** Returns a fresh medicine draft with sensible defaults for the wizard. */
export const blank = (): MedicineInput => ({
  name: "",
  strength: "",
  form: "Pill",
  condition: "",
  frequencyPattern: "daily",
  specificDays: [],
  cycleEvery: 1,
  cycleUnit: "days",
  times: [], // no default time: the user must choose each dose time
  liquid: "No liquid needed",
  withFood: false,
  startDate: today(),
  durationType: "ongoing",
  durationValue: 30,
  durationUnit: "days",
  supplyCount: 30,
  refillThreshold: 7,
  isRecurring: true,
});

/**
 * Describes a medicine's frequency in plain words.
 * @param m - Medicine (only schedule fields are read).
 */
export function frequencyLabel(
  m: Pick<MedicineInput, "frequencyPattern" | "specificDays" | "cycleEvery" | "cycleUnit">,
): string {
  switch (m.frequencyPattern) {
    case "daily":
      return "Every day";
    case "everyOtherDay":
      return "Every other day";
    case "specificDays":
      return (m.specificDays || []).join(", ") || "Specific days";
    default:
      return `Every ${m.cycleEvery} ${m.cycleUnit}`;
  }
}

/**
 * True when a medicine record is no longer current because its schedule was rescheduled
 * into a newer record (from `endedOn`).
 * @param m - Medicine.
 * @param date - Date to test, defaults to today.
 */
export function isEnded(m: { endedOn?: string | null }, date = today()): boolean {
  return !!m.endedOn && m.endedOn <= date;
}

/**
 * True when the medicine is paused on the given date.
 * @param m - Medicine with optional pause range.
 * @param date - Date to test (`YYYY-MM-DD`), defaults to today.
 */
export function isPausedOn(
  m: { pauseStartDate?: string | null; pauseEndDate?: string | null },
  date = today(),
): boolean {
  return (
    !!m.pauseStartDate && m.pauseStartDate <= date && (!m.pauseEndDate || m.pauseEndDate >= date)
  );
}
