import { useState } from "react";
import { Plus, X } from "lucide-react";
import { conditions } from "../constants/options";

type ConditionPickerProps = {
  /** Currently selected conditions. */
  selected: string[];
  /** Receives the new selection. */
  onChange: (v: string[]) => void;
};

/**
 * Searchable multi-select for conditions. Suggestions come from the common list, and the
 * user can add a condition that isn't listed (previously impossible).
 */
export function ConditionPicker({ selected, onChange }: ConditionPickerProps) {
  const [q, setQ] = useState("");
  const term = q.trim();
  const options = conditions
    .filter(
      (x) => x !== "Other" && x.toLowerCase().includes(term.toLowerCase()) && !selected.includes(x),
    )
    .slice(0, 6);
  const canAddCustom =
    term.length >= 2 &&
    !conditions.concat(selected).some((x) => x.toLowerCase() === term.toLowerCase());

  /** Adds a condition and clears the search box. */
  const add = (value: string) => {
    onChange([...selected, value]);
    setQ("");
  };

  return (
    <div className="condition-picker">
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((x) => (
            <button
              type="button"
              className="chip selected"
              key={x}
              onClick={() => onChange(selected.filter((v) => v !== x))}
              aria-label={`Remove ${x}`}
            >
              {x}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (options[0]) add(options[0]);
          else if (canAddCustom) add(term);
        }}
        placeholder="Search or type a condition"
        aria-label="Search conditions"
      />
      {term && (options.length > 0 || canAddCustom) && (
        <div className="suggestions" role="listbox">
          {options.map((x) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={x}
              onClick={() => add(x)}
            >
              {x}
            </button>
          ))}
          {canAddCustom && (
            <button type="button" role="option" aria-selected="false" onClick={() => add(term)}>
              <Plus size={14} aria-hidden="true" /> Add “{term}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
