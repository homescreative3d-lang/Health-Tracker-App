import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

export function ForgotScreen({
  onBack,
  onSent,
}: {
  onBack: () => void;
  onSent: (m: string) => void;
}) {
  const [e, setE] = useState(""),
    [error, setError] = useState("");
  return (
    <section className="narrow-card">
      <button className="icon-btn back" onClick={onBack} aria-label="Back">
        <ArrowLeft />
      </button>
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h2>Reset your password</h2>
      <p className="muted lead">
        Enter your account email and we'll send instructions to reset your password.
      </p>
      <Field label="Email">
        <input
          className="input"
          value={e}
          onChange={(x) => setE(x.target.value)}
          placeholder="you@email.com"
          type="email"
        />
      </Field>
      {error && <InlineError>{error}</InlineError>}
      <button
        className="btn primary full"
        onClick={async () => {
          if (!/^\S+@\S+\.\S+$/.test(e.trim())) return setError("Enter a valid email address.");
          try {
            await api.forgotPassword(e.trim().toLowerCase());
            setError("");
            onSent("If an account exists for this email, reset instructions have been sent.");
          } catch (x) {
            setError(err(x));
          }
        }}
      >
        Send reset link
      </button>
    </section>
  );
}
