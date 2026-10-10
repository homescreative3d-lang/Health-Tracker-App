import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

type ResetScreenProps = {
  /** Called with a success message after the password is changed. */
  onDone: (m: string) => void;
  /** Returns to the login screen. */
  onBack: () => void;
};

/** Sets a new password using the `?reset=` token from the emailed link. */
export function ResetScreen({ onDone, onBack }: ResetScreenProps) {
  const token = new URLSearchParams(window.location.search).get("reset") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(
    token ? "" : "This reset link is incomplete. Request a new one.",
  );
  const [busy, setBusy] = useState(false);

  /** Validates both fields and submits the new password. */
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      onDone("Password updated. You can log in now.");
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="narrow-card card" onSubmit={save}>
      <button type="button" className="icon-btn back" onClick={onBack} aria-label="Back to log in">
        <ArrowLeft />
      </button>
      <h2>Choose a new password</h2>
      <Field label="New password">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(x) => setPassword(x.target.value)}
        />
      </Field>
      <Field label="Confirm password">
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(x) => setConfirm(x.target.value)}
        />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <button type="submit" className="btn primary full" disabled={busy || !token}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
