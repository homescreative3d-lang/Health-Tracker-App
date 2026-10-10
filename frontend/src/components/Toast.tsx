import { AlertCircle, Check, X } from "lucide-react";
import type { ToastMessage } from "../hooks/useToast";

/** Live-region toast announced by screen readers; errors use `role="alert"`. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className={toast.error ? "toast error-toast" : "toast"}
      role={toast.error ? "alert" : "status"}
      aria-live={toast.error ? "assertive" : "polite"}
    >
      <span className="toast-icon">
        {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
      </span>
      <span className="toast-text">{toast.message}</span>
      <button className="toast-close" onClick={onDismiss} aria-label="Dismiss message">
        <X size={16} />
      </button>
    </div>
  );
}
