import { useEffect, useState } from "react";

/** Quick choices per medicine form, using the units people actually say. */
const PRESETS: Record<
  string,
  { chips: string[]; unit: string; numeric?: boolean; units?: string[] }
> = {
  pill: {
    chips: [
      "¼ tablet",
      "⅓ tablet",
      "½ tablet",
      "¾ tablet",
      "1 tablet",
      "1½ tablets",
      "2 tablets",
      "3 tablets",
    ],
    unit: "tablet",
  },
  syrup: {
    chips: ["2.5 ml", "5 ml", "7.5 ml", "10 ml", "15 ml", "20 ml"],
    unit: "ml",
    numeric: true,
    units: ["ml"],
  },
  drops: {
    chips: ["1 drop", "2 drops", "3 drops", "5 drops", "10 drops"],
    unit: "drops",
    numeric: true,
    units: ["drops"],
  },
  inhaler: {
    chips: ["1 puff", "2 puffs", "3 puffs"],
    unit: "puffs",
    numeric: true,
    units: ["puffs"],
  },
  injection: {
    chips: ["0.5 ml", "1 ml", "2 ml", "5 units", "10 units", "20 units"],
    unit: "units",
    numeric: true,
    units: ["units", "ml", "mg"],
  },
  powder: {
    chips: ["½ sachet", "1 sachet", "2 sachets", "5 g", "10 g"],
    unit: "sachet",
    numeric: true,
    units: ["sachet", "g", "scoop"],
  },
  other: { chips: [], unit: "" },
};

type DoseAmountPickerProps = {
  /** Medicine form (Pill, Syrup, Drops…). */
  form: string;
  /** Current value, e.g. "½ tablet". */
  value: string;
  onChange: (v: string) => void;
};

/**
 * Required "how much per dose" input that adapts to the medicine form: fraction chips for
 * tablets, ml for syrups, drops, puffs, units… plus a custom amount for anything else.
 */
export function DoseAmountPicker({ form, value, onChange }: DoseAmountPickerProps) {
  const preset = PRESETS[(form || "pill").toLowerCase()] || PRESETS.other;
  const isChip = preset.chips.includes(value);
  const [custom, setCustom] = useState(!isChip && !!value);
  const [num, setNum] = useState("");
  const [unit, setUnit] = useState(preset.units?.[0] || preset.unit);

  // Reset the custom unit when the form changes.
  useEffect(() => {
    setUnit(preset.units?.[0] || preset.unit);
  }, [preset]);

  return (
    <div className="dose-amount-picker">
      {preset.chips.length > 0 && (
        <div className="chips" role="radiogroup" aria-label="Amount per dose">
          {preset.chips.map((c) => (
            <button
              type="button"
              role="radio"
              aria-checked={value === c}
              key={c}
              className={value === c ? "chip selected" : "chip"}
              onClick={() => {
                setCustom(false);
                onChange(c);
              }}
            >
              {c}
            </button>
          ))}
          <button
            type="button"
            className={custom ? "chip selected" : "chip"}
            onClick={() => setCustom(true)}
          >
            Custom…
          </button>
        </div>
      )}
      {(custom || preset.chips.length === 0) &&
        (preset.numeric ? (
          <div className="dose-amount-custom">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              aria-label="Amount"
              value={num}
              onChange={(e) => {
                setNum(e.target.value);
                onChange(e.target.value ? `${e.target.value} ${unit}` : "");
              }}
            />
            <select
              className="input"
              aria-label="Unit"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value);
                if (num) onChange(`${num} ${e.target.value}`);
              }}
            >
              {(preset.units || [preset.unit]).map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        ) : (
          <input
            className="input"
            value={isChip ? "" : value}
            maxLength={60}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 1 tablet dissolved in water, 1 patch"
            aria-label="Custom amount"
          />
        ))}
    </div>
  );
}
