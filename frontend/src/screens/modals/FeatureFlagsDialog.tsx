import { useEffect, useState } from "react";
import { ToggleRight, X } from "lucide-react";
import { api } from "../../api";
import { err } from "../../lib/errors";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";

type Flag = {
  key: string;
  description: string;
  enabled: boolean;
  overrides: { userId: string; email: string; enabled: boolean }[];
};

/**
 * System-admin panel for DB-driven feature flags: switch a feature for everyone, or add a
 * per-user override by exact email (overrides win over the global value).
 */
export function FeatureFlagsDialog({ onClose }: { onClose: () => void }) {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState<Record<string, string>>({});

  /** Reloads all flags. */
  const load = () =>
    api
      .adminFeatures()
      .then((f) => setFlags(Array.isArray(f) ? f : []))
      .catch((e) => setError(err(e)));
  useEffect(() => {
    void load();
  }, []);

  /** Runs a change then reloads. */
  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(err(e));
    }
  };

  /** Adds a per-user override for the email typed under a flag. */
  const addOverride = (key: string, enabled: boolean) =>
    act(async () => {
      const users = await api.familySearch((email[key] || "").trim().toLowerCase());
      if (!users.length) throw new Error("No account uses that email.");
      await api.setUserFeature(key, users[0].id, enabled);
      setEmail((v) => ({ ...v, [key]: "" }));
    });

  return (
    <Modal
      title="Feature flags"
      icon={<ToggleRight size={20} />}
      onClose={onClose}
      className="flags-modal"
    >
      <p className="muted">
        Everything is on by default. Per-user overrides win over the global switch.
      </p>
      {error && <InlineError>{error}</InlineError>}
      {!flags ? (
        <div className="preview-loading" role="status">
          Loading…
        </div>
      ) : (
        <ul className="flag-list">
          {flags.map((f) => (
            <li key={f.key} className="flag-item">
              <div className="flag-head">
                <div>
                  <b>{f.description || f.key}</b>
                  <small>{f.key}</small>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={f.enabled}
                    onChange={(e) => act(() => api.setFeature(f.key, e.target.checked))}
                  />
                  <span className="toggle-track" aria-hidden="true">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">{f.enabled ? "On" : "Off"}</span>
                </label>
              </div>
              {f.overrides.length > 0 && (
                <div className="chips">
                  {f.overrides.map((o) => (
                    <span key={o.userId} className={o.enabled ? "chip selected" : "chip"}>
                      {o.email}: {o.enabled ? "on" : "off"}
                      <button
                        type="button"
                        aria-label={`Remove override for ${o.email}`}
                        onClick={() => act(() => api.setUserFeature(f.key, o.userId, null))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flag-override">
                <input
                  className="input"
                  type="email"
                  placeholder="user@example.com"
                  aria-label={`User email for ${f.key} override`}
                  value={email[f.key] || ""}
                  onChange={(e) => setEmail((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn soft sm"
                  onClick={() => addOverride(f.key, true)}
                >
                  On for user
                </button>
                <button
                  type="button"
                  className="btn soft sm"
                  onClick={() => addOverride(f.key, false)}
                >
                  Off for user
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
