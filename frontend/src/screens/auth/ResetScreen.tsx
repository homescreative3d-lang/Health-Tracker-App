import { useState } from "react";
import { api } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";

export function ResetScreen({ onDone }: { onDone: (m: string) => void }) {
  const token = new URLSearchParams(window.location.search).get("reset") || "",
    [p, setP] = useState(""),
    [c, setC] = useState(""),
    [e, setE] = useState("");
  const save = async () => {
    if (p.length < 8) return setE("Password must be at least 8 characters.");
    if (p !== c) return setE("Passwords do not match.");
    try {
      await api.resetPassword(token, p);
      onDone("Password updated. You can log in now.");
    } catch (x) {
      setE(err(x));
    }
  };
  return (
    <section className="narrow-card">
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h2>Choose a new password</h2>
      <Field label="New password">
        <input className="input" type="password" value={p} onChange={(x) => setP(x.target.value)} />
      </Field>
      <Field label="Confirm password">
        <input className="input" type="password" value={c} onChange={(x) => setC(x.target.value)} />
      </Field>
      {e && <InlineError>{e}</InlineError>}
      <button className="btn primary full" onClick={save}>
        Update password
      </button>
    </section>
  );
}
