import type { MedicalRecord, MedicineInput, RecordMedicine } from "../api";
import { blank } from "../constants/options";

/** Guesses the medicine form from its name/dose text. */
function guessForm(m: RecordMedicine): string {
  const t = `${m.name} ${m.dose || ""} ${m.strength || ""}`.toLowerCase();
  if (/syrup|suspension|\bml\b|liquid/.test(t)) return "Syrup";
  if (/drop/.test(t)) return "Drops";
  if (/inhal|puff|rotacap/.test(t)) return "Inhaler";
  if (/inj|insulin|units?\b/.test(t)) return "Injection";
  if (/powder|sachet|granule/.test(t)) return "Powder";
  return "Pill";
}

/** Reads "5 days", "2 weeks", "1 month" into days (null when ongoing/unknown). */
function durationDays(text?: string): number | null {
  const m = /(\d+)\s*(day|week|month)/i.exec(text || "");
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase().startsWith("week")
    ? n * 7
    : m[2].toLowerCase().startsWith("month")
      ? n * 30
      : n;
}

/**
 * Turns the medicines on a saved prescription into medicine-form drafts. Everything the
 * prescription states is pre-filled; dose times and stock are left for the user to set
 * (there is never a default time).
 * @param record - A prescription record with medicines.
 */
export function prescriptionDrafts(
  record: MedicalRecord,
): { draft: MedicineInput; hint: string }[] {
  const condition = record.title.replace(/^prescription:\s*/i, "").trim();
  return record.medicines
    .filter((m) => m.name.trim())
    .map((m) => {
      const days = durationDays(m.duration);
      const form = guessForm(m);
      const draft: MedicineInput = {
        ...blank(),
        name: m.name.trim(),
        strength: (m.strength || "").trim(),
        form,
        condition: condition && !/^prescription/i.test(condition) ? condition : "",
        doseAmount: (m.dose || "").trim(),
        withFood: /(after|with)\s+(food|meal)/i.test(m.instructions || ""),
        prescribedBy: record.doctor,
        durationType: days ? "fixed" : "ongoing",
        durationValue: days || 30,
        durationUnit: "days",
        times: [],
      };
      const said = [
        m.frequency && `how often: ${m.frequency}`,
        m.duration && `for ${m.duration}`,
        m.instructions,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        draft,
        hint: `${said ? `Prescription says ${said}. ` : ""}Set the dose times and how much you have, then save. AI-read details may contain mistakes, so check them.`,
      };
    });
}
