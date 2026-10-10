import type { ReactNode } from "react";

type FieldProps = {
  /** Visible label text. */
  label: string;
  /** Optional hint ("optional", "required") shown after the label. */
  hint?: string;
  /** The control(s) being labeled. */
  children: ReactNode;
  /** Spans both columns inside `.form-grid`. */
  full?: boolean;
};

/** Label + control wrapper; wrapping in `<label>` gives the control an accessible name. */
export function Field({ label, hint, children, full }: FieldProps) {
  return (
    <label className={full ? "field full-field" : "field"}>
      <span className="field-label">
        {label}
        {hint && <em>{hint}</em>}
      </span>
      {children}
    </label>
  );
}
