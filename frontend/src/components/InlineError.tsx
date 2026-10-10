import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

/** Form-level validation message announced to screen readers. */
export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error" role="alert">
      <AlertCircle size={17} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
