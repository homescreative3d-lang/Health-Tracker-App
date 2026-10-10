import { useState } from "react";
import { ArrowLeft, Camera, FileImage } from "lucide-react";
import { api, type User as ApiUser } from "../../api";
import { err } from "../../lib/errors";
import { Field } from "../../components/Field";
import { Profile } from "./Profile";

export function AccountDetails({
  user,
  onBack,
  onSave,
  title,
}: {
  user: ApiUser;
  onBack: () => void;
  onSave: (u: ApiUser) => void;
  title: string;
}) {
  const [displayName, setDisplayName] = useState(user.displayName),
    [image, setImage] = useState(user.profileImageUrl || ""),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async () => {
    if (!displayName.trim() || displayName.trim().length > 80) {
      setMsg("Enter a name of 1–80 characters.");
      return;
    }
    setBusy(true);
    try {
      const u = await api.updateProfile({
        displayName: displayName.trim(),
        profileImageUrl: image,
      });
      onSave(u);
      setMsg("Details saved.");
    } catch (e) {
      setMsg(err(e));
    } finally {
      setBusy(false);
    }
  };
  const initials = (displayName || "?")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>{title}</h1>
          <p className="muted">
            These are your details as the signed-in caregiver, not the patient’s details.
          </p>
        </div>
        <button className="btn soft" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>
      </div>
      <div className="card account-edit-card">
        <div className="profile-head">
          {image ? (
            <img className="avatar" src={image} alt="Profile" />
          ) : (
            <div className="avatar">{initials}</div>
          )}
          <div>
            <b>{displayName || user.displayName}</b>
            <span className="muted">{user.email}</span>
          </div>
        </div>
        <Field label="Your display name">
          <input
            className="input"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </Field>
        <Field label="Profile photo">
          <div className="photo-actions">
            <label className="btn soft upload-btn">
              <FileImage size={15} />
              Gallery
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1024 * 1024) {
                    setMsg("Image must be 1 MB or smaller.");
                    return;
                  }
                  const ext = f.name.split(".").pop()?.toLowerCase() || "";
                  const mime =
                    f.type ||
                    (
                      {
                        jpg: "image/jpeg",
                        jpeg: "image/jpeg",
                        png: "image/png",
                        heic: "image/heic",
                        heif: "image/heif",
                      } as Record<string, string>
                    )[ext] ||
                    "image/jpeg";
                  const reader = new FileReader();
                  reader.onload = () => {
                    let data = String(reader.result);
                    if (!data.startsWith("data:image/")) data = data.replace(/^data:[^;,]*/, mime);
                    setImage(data);
                  };
                  reader.readAsDataURL(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label className="btn soft upload-btn">
              <Camera size={15} />
              Camera
              <input
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 1024 * 1024) {
                    setMsg("Image must be 1 MB or smaller.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setImage(String(reader.result));
                  reader.readAsDataURL(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button className="btn soft" onClick={() => setImage("")}>
              Remove photo
            </button>
          </div>
        </Field>
        <Field label="Email address">
          <input className="input" value={user.email} readOnly />
          <small className="field-hint">Email address cannot be changed here.</small>
        </Field>
        {msg && (
          <p className="notification-settings-message" role="status">
            {msg}
          </p>
        )}
        <div className="modal-actions">
          <button className="btn soft" onClick={onBack}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save details"}
          </button>
        </div>
      </div>
    </div>
  );
}
