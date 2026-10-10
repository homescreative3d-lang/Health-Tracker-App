import { useState } from "react";
import { X } from "lucide-react";
import { conditions } from "../constants/options";

export function ConditionPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const options = conditions
    .filter((x) => x.toLowerCase().includes(q.toLowerCase()) && !selected.includes(x))
    .slice(0, 6);
  return (
    <div className="condition-picker">
      <div className="chips">
        {selected.map((x) => (
          <button
            type="button"
            className="chip selected"
            key={x}
            onClick={() => onChange(selected.filter((v) => v !== x))}
          >
            {x}
            <X size={13} />
          </button>
        ))}
      </div>
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a condition…"
      />
      {q && options.length > 0 && (
        <div className="suggestions">
          {options.map((x) => (
            <button
              type="button"
              key={x}
              onClick={() => {
                onChange([...selected, x]);
                setQ("");
              }}
            >
              {x}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
