import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, type User } from "../../api";
import { err } from "../../lib/errors";
import { Avatar } from "../../components/Avatar";
import { Field } from "../../components/Field";
import { ImagePickerButtons } from "../../components/ImagePickerButtons";
import { InlineError } from "../../components/InlineError";
import { PageHeader } from "../../components/PageHeader";

type AccountDetailsProps = {
  user: User;
  onBack: () => void;
  /** Receives the updated user after a successful save. */
  onSave: (u: User) => void;
};

/** Edits the signed-in caregiver's display name and photo (email is read-only). */
export function AccountDetails({ user, onBack, onSave }: AccountDetailsProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [image, setImage] = useState(user.profileImageUrl || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = displayName !== user.displayName || image !== (user.profileImageUrl || "");

  /** Validates and saves the profile. */
  const save = async () => {
    setError("");
    if (displayName.trim().length < 2 || displayName.trim().length > 80) {
      setError("Enter a name between 2 and 80 characters.");
      return;
    }
    setBusy(true);
    try {
      onSave(await api.updateProfile({ displayName: displayName.trim(), profileImageUrl: image }));
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-scroll">
      <PageHeader
        kicker="Account"
        title="Your details"
        description="These are your details as the signed-in caregiver, not a patient's."
        actions={
          <button className="btn soft" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
        }
      />
      <form
        className="card account-edit-card"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="profile-head">
          <Avatar name={displayName || user.displayName} src={image} size="lg" />
          <div>
            <b>{displayName || user.displayName}</b>
            <span className="muted">{user.email}</span>
          </div>
        </div>
        <Field label="Display name">
          <input
            className="input"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </Field>
        <div className="field">
          <span className="field-label">Profile photo</span>
          <ImagePickerButtons
            label="profile photo"
            onPick={setImage}
            onError={setError}
            onRemove={image ? () => setImage("") : undefined}
          />
        </div>
        <Field label="Email address">
          <input className="input" value={user.email} readOnly aria-readonly="true" />
          <small className="field-hint">Email can't be changed here.</small>
        </Field>
        {error && <InlineError>{error}</InlineError>}
        <div className="form-actions">
          <button type="button" className="btn soft" onClick={onBack}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>
    </div>
  );
}
