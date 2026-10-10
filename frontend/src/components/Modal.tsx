import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  /** Dialog heading (also used as the accessible name). */
  title: ReactNode;
  /** Optional short label shown above the title. */
  kicker?: ReactNode;
  /** Optional icon shown next to the title. */
  icon?: ReactNode;
  /** Called on Escape, backdrop click or the close button. */
  onClose: () => void;
  /** Footer actions (buttons). */
  actions?: ReactNode;
  /** Extra class for size variants, e.g. "modal-wide". */
  className?: string;
  /** When false, backdrop clicks don't close (used by multi-step forms to avoid data loss). */
  closeOnBackdrop?: boolean;
  children: ReactNode;
};

/**
 * Accessible dialog: renders as a centered card on tablet/desktop and as a bottom sheet
 * on phones. Handles Escape, backdrop click, initial focus, focus return and body scroll lock.
 */
export function Modal({
  title,
  kicker,
  icon,
  onClose,
  actions,
  className = "",
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(
      "input, select, textarea, button:not(.modal-close)",
    );
    (first || dialog)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !dialog) return;
      // Keep keyboard focus inside the dialog.
      const items = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!items.length) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-head">
          {icon && <span className="modal-icon">{icon}</span>}
          <div>
            {kicker && <span className="eyebrow">{kicker}</span>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {actions && <footer className="modal-actions">{actions}</footer>}
      </section>
    </div>
  );
}
