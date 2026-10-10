import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

type ForgotScreenProps = {
  onBack: () => void;
  /** Called with a confirmation message once the request is accepted. */
  onSent: (m: string) => void;
};

/** Requests a password-reset email. The response never reveals whether the account exists. */
export function ForgotScreen({ onBack, onSent }: ForgotScreenProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  /** Validates the email and requests the reset link. */
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      setError("");
      setSent(true);
      onSent("If an account exists for this email, a reset link is on its way.");
    } catch (x) {
      setError(err(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="narrow-card card" onSubmit={submit}>
      <button type="button" className="icon-btn back" onClick={onBack} aria-label="Back to log in">
        <ArrowLeft />
      </button>
      <h2>Reset your password</h2>
      {sent ? (
        <div className="notice success" role="status">
          <MailCheck aria-hidden="true" />
          <p>Check your inbox for a reset link. It expires in 30 minutes.</p>
        </div>
      ) : (
        <p className="muted lead">
          Enter your account email and we'll send a link to choose a new password.
        </p>
      )}
      <Field label="Email">
        <input
          className="input"
          value={email}
          onChange={(x) => setEmail(x.target.value)}
          placeholder="you@email.com"
          type="email"
          autoComplete="email"
        />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <button type="submit" className="btn primary full" disabled={busy}>
        {busy ? "Sending…" : sent ? "Send again" : "Send reset link"}
      </button>
    </form>
  );
}
