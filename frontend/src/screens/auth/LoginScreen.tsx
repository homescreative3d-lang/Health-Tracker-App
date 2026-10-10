import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { api, type AuthResult } from "../../api";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

/**
 * Sign-in / sign-up screen with client-side validation matching the API rules.
 * Submitting runs `onSuccess`, which loads the hub (or onboarding for new accounts).
 */
export function LoginScreen({
  initialMode = "signin",
  onSuccess,
  onForgot,
  onError,
}: {
  /** Tab to open first ("signin" or "signup"), chosen from the landing navbar. */
  initialMode?: "signin" | "signup";
  onSuccess: (r: AuthResult, register: boolean) => Promise<void>;
  onForgot: () => void;
  onError: (m: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState("");
  /** Validates the form and calls the login or register endpoint. */
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
        <img className="auth-mark" src="/tended-icon.svg" alt="" width={56} height={56} />
        <h1>Every dose, on time, for everyone you care for.</h1>
        <p>
          Tended keeps medicine schedules, refill reminders and a shared dose record in one calm
          place for patients and family caregivers.
        </p>
        <ul className="feature-pills">
          <li>Daily schedules by time of day</li>
          <li>Refill and missed-dose alerts</li>
          <li>Shared with family, with consent</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-head">
          <div>
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="muted">
              {mode === "signin"
                ? "Pick up where you left off."
                : "A few details and you're ready to begin."}
            </p>
          </div>
        </div>
        <div className="segmented" role="tablist" aria-label="Log in or sign up">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
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
            role="tab"
            aria-selected={mode === "signup"}
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
            <Mail aria-hidden="true" />
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
            <Lock aria-hidden="true" />
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
        <button type="submit" className="btn primary full" disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : mode === "signin" ? (
            "Log in"
          ) : (
            "Create account"
          )}
        </button>
        <p className="fine muted">
          Tended organizes medicines; it doesn't replace advice from a doctor or pharmacist.
        </p>
      </form>
    </section>
  );
}
