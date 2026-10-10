import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <div className="inline-error">
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  );
}
