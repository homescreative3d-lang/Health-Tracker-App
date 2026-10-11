import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Modal } from "./Modal";

/** Options for a confirmation prompt. */
export type ConfirmOptions = {
  title: string;
  message: string;
  /** Confirm button text, e.g. "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for irreversible actions (red button), "default" otherwise. */
  tone?: "danger" | "default";
  /** When set, the user must type this word to enable the confirm button. */
  requireText?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
let push: ((p: Pending) => void) | null = null;

/**
 * Shows a themed confirmation dialog and resolves to the user's answer. Replaces the browser's
 * `window.confirm`, which can't be styled and is blocked in some embedded/Android web views.
 * @param options - Title, message and button labels.
 * @returns True when confirmed.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(`${options.title}\n\n${options.message}`));
    push({ ...options, resolve });
  });
}

/** Renders pending confirmations; mount once near the app root. */
export function ConfirmHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    push = (p) => setQueue((q) => [...q, p]);
    return () => {
      push = null;
    };
  }, []);
  const current = queue[0];
  if (!current) return null;

  /** Resolves the front prompt and shows the next one. */
  const answer = (ok: boolean) => {
    current.resolve(ok);
    setTyped("");
    setQueue((q) => q.slice(1));
  };
  const danger = current.tone !== "default";
  const blocked =
    !!current.requireText && typed.trim().toUpperCase() !== current.requireText.toUpperCase();

  return (
    <Modal
      title={current.title}
      icon={danger ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
      onClose={() => answer(false)}
      className={danger ? "confirm-modal danger" : "confirm-modal"}
      actions={
        <>
          <button type="button" className="btn soft" onClick={() => answer(false)}>
            {current.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            className={danger ? "btn danger" : "btn primary"}
            disabled={blocked}
            onClick={() => answer(true)}
          >
            {current.confirmLabel || "Confirm"}
          </button>
        </>
      }
    >
      <p className="confirm-message">{current.message}</p>
      {current.requireText && (
        <label className="field">
          <span className="field-label">Type {current.requireText} to confirm</span>
          <input
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
    </Modal>
  );
}
