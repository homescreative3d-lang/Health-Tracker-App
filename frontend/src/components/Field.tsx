import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const plain = label.replace(/<[^>]*>/g, "");
  return (
    <label className="field">
      <span className="field-label">{plain}</span>
      {children}
    </label>
  );
}
