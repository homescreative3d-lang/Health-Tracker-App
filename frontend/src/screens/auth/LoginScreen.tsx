import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api, type User as ApiUser } from "../../api";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

export function LoginScreen({
  onSuccess,
  onForgot,
  onError,
}: {
  onSuccess: (r: { user: ApiUser; token: string }, register: boolean) => Promise<void>;
  onForgot: () => void;
  onError: (m: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError("");
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setLocalError("Enter a valid email address.");
    if (password.length < 8) return setLocalError("Password must be at least 8 characters.");
    if (mode === "signup" && (name.trim().length < 2 || name.trim().length > 80))
      return setLocalError("Enter your name (2–80 characters).");
    setBusy(true);
    try {
      const r =
        mode === "signin"
          ? await api.login({ email: em, password })
          : await api.register({
              email: em,
              password,
              displayName: name.trim(),
            });
      await onSuccess(r, mode === "signup");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Unable to complete sign in.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <span className="eyebrow">MEDICATION MADE HEALTH COMPANION</span>
        <h1>Feel more in control of every dose.</h1>
        <p>Keep medicines, schedules and daily progress in one calm, simple place.</p>
        <div className="feature-pills">
          <span>✓ Clear schedules</span>
          <span>✓ Refill reminders</span>
          <span>✓ Caregiver friendly</span>
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-head">
          <img className="auth-logo" src="/tended-logo.svg" alt="TENDED" />
          <div>
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">
              {mode === "signin"
                ? "Pick up where you left off."
                : "A few details and you're ready to begin."}
            </p>
          </div>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={mode === "signin" ? "selected" : ""}
            onClick={() => {
              setMode("signin");
              setLocalError("");
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "selected" : ""}
            onClick={() => {
              setMode("signup");
              setLocalError("");
            }}
          >
            Sign up
          </button>
        </div>
        {mode === "signup" && (
          <Field label="Your name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grace Whitfield"
              autoComplete="name"
            />
          </Field>
        )}
        <Field label="Email">
          <div className="icon-input">
            <Mail />
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              autoComplete="email"
            />
          </div>
        </Field>
        <Field label="Password">
          <div className="icon-input">
            <Lock />
            <input
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              type={show ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </Field>
        {localError && <InlineError>{localError}</InlineError>}
        {mode === "signin" && (
          <div className="forgot">
            <button type="button" className="text-btn" onClick={onForgot}>
              Forgot password?
            </button>
          </div>
        )}
        <button className="btn primary full" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" />
              Please wait…
            </>
          ) : mode === "signin" ? (
            "Log in"
          ) : (
            "Create account"
          )}
        </button>
        <p className="fine muted">Your account is protected with secure authentication.</p>
      </form>
    </section>
  );
}
