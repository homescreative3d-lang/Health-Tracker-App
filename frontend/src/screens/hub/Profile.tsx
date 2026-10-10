import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChevronRight,
  HeartPulse,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type { Patient, User as ApiUser } from "../../api";
import type { HubTab } from "../../components/navigation/navItems";
import { Avatar } from "../../components/Avatar";
import { Modal } from "../../components/Modal";
import { EmptyArt } from "../../components/art/EmptyArt";

type ProfileProps = {
  user: ApiUser;
  patients: Patient[];
  setTab: (v: HubTab) => void;
  onPatientView: (p: Patient) => Promise<void>;
  onPatientEdit: (p: Patient) => Promise<void>;
  onAddPatient: () => void;
  onAddSelfPatient: () => void;
  onGuide: () => void;
  onDeleteAccount: () => Promise<void>;
};

/** One row in the profile's settings lists. */
function ProfileAction({
  icon,
  title,
  text,
  onClick,
  tone = "teal",
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  /** Accent color of the icon tile. */
  tone?: "teal" | "morning" | "evening" | "night";
}) {
  return (
    <button className={`profile-action tone-${tone}`} onClick={onClick}>
      <span className="profile-action-icon">{icon}</span>
      <span className="profile-action-copy">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

/** Row linking to a patient profile, with a separate edit shortcut. */
function PatientRow({ p, onView, onEdit }: { p: Patient; onView: () => void; onEdit: () => void }) {
  return (
    <div className="patient-summary-row">
      <button className="patient-summary-card" onClick={onView}>
        <Avatar name={p.name} src={p.profileImageUrl} />
        <span className="patient-summary-copy">
          <b>{p.name || "Unnamed patient"}</b>
          <small>
            {p.relationship === "self" ? "My health profile" : p.relationship || "Patient"}
            {p.ownerName ? ` · managed by ${p.ownerName}` : ""}
          </small>
        </span>
        <span className="patient-open-label">
          View <ChevronRight size={15} aria-hidden="true" />
        </span>
      </button>
      <button
        className="icon-btn patient-edit-shortcut"
        aria-label={`Edit ${p.name || "patient"}`}
        onClick={onEdit}
      >
        <Pencil size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Account hub: personal info, people cared for, own health profile, settings and account deletion.
 * "Caregiver details" previously opened the same form as "Edit personal info"; the duplicate was removed.
 */
export function Profile({
  user,
  patients,
  setTab,
  onPatientView,
  onPatientEdit,
  onAddPatient,
  onAddSelfPatient,
  onGuide,
  onDeleteAccount,
}: ProfileProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const caredFor = patients.filter((p) => p.relationship !== "self" && p.name);
  const ownPlans = patients.filter((p) => p.relationship === "self");

  return (
    <div className="page-scroll profile-page">
      <section className="profile-banner">
        <div className="profile-banner-art" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <Avatar
          name={user.displayName}
          src={user.profileImageUrl}
          size="xl"
          className="profile-banner-avatar"
        />
        <div className="profile-banner-copy">
          <span className="eyebrow">Your account</span>
          <h1>{user.displayName}</h1>
          <p>{user.email}</p>
          <div className="profile-banner-stats">
            <span>
              <b>{caredFor.length}</b> {caredFor.length === 1 ? "person" : "people"} cared for
            </span>
            <span>
              <b>{ownPlans.length ? "Yes" : "No"}</b> personal profile
            </span>
          </div>
        </div>
        <button className="btn light" onClick={() => setTab("profileDetails")}>
          <User size={16} aria-hidden="true" />
          Edit details
        </button>
      </section>

      <section className="profile-section">
        <div className="section-heading">
          <div>
            <h3>People I care for</h3>
            <p className="muted">Patients you manage for someone else.</p>
          </div>
          <button className="btn primary" onClick={onAddPatient}>
            <Plus size={16} aria-hidden="true" />
            Add patient
          </button>
        </div>
        {caredFor.length ? (
          <div className="patient-cards">
            {caredFor.map((p) => (
              <PatientRow
                key={p.id}
                p={p}
                onView={() => onPatientView(p)}
                onEdit={() => onPatientEdit(p)}
              />
            ))}
          </div>
        ) : (
          <div className="card empty-card compact">
            <EmptyArt kind="people" size={112} />
            <b>No one added yet</b>
            <span className="muted">Add a patient to manage their medicines and history.</span>
          </div>
        )}
      </section>

      <section className="profile-section">
        <div className="section-heading">
          <div>
            <h3>My health profile</h3>
            <p className="muted">Keep your own medicines separate from the people you care for.</p>
          </div>
        </div>
        {ownPlans.length ? (
          <div className="patient-cards">
            {ownPlans.map((p) => (
              <PatientRow
                key={p.id}
                p={p}
                onView={() => onPatientView(p)}
                onEdit={() => onPatientEdit(p)}
              />
            ))}
          </div>
        ) : (
          <div className="self-care-prompt card">
            <HeartPulse aria-hidden="true" />
            <div>
              <b>Track your own medicines too</b>
              <p className="muted">
                Create a personal profile for your history, doctor and prescriptions.
              </p>
            </div>
            <button className="btn soft" onClick={onAddSelfPatient}>
              <Plus size={16} aria-hidden="true" />
              Add my profile
            </button>
          </div>
        )}
      </section>

      <section className="card profile-section profile-tools">
        <ProfileAction
          icon={<Users size={20} />}
          tone="evening"
          title="Family"
          text="Members, invitations and consent"
          onClick={() => setTab("family")}
        />
        <ProfileAction
          icon={<Bell size={20} />}
          tone="night"
          title="Notifications"
          text="Reminder timing and device alerts"
          onClick={() => setTab("notifications")}
        />
        <ProfileAction
          icon={<BookOpen size={20} />}
          tone="morning"
          title="How to use Tended"
          text="A two-minute guide"
          onClick={onGuide}
        />
      </section>

      <section className="card delete-account-section">
        <div className="delete-account-copy">
          <span className="delete-account-icon">
            <ShieldAlert size={20} aria-hidden="true" />
          </span>
          <div>
            <h3>Delete account</h3>
            <p className="muted">
              Allowed when no doses are pending, or when every patient you manage has another
              approved caregiver. Care plans are transferred to them so reminders continue.
            </p>
          </div>
        </div>
        <button className="btn danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} aria-hidden="true" />
          Delete my account
        </button>
      </section>

      {confirmDelete && (
        <Modal
          title="Delete your account?"
          icon={<ShieldAlert size={20} />}
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <button className="btn soft" onClick={() => setConfirmDelete(false)}>
                Keep account
              </button>
              <button
                className="btn danger"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={async () => {
                  setDeleting(true);
                  await onDeleteAccount();
                  setDeleting(false);
                  setConfirmDelete(false);
                }}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </>
          }
        >
          <p className="muted">This can't be undone. Type DELETE to confirm.</p>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="Type DELETE to confirm"
            autoComplete="off"
          />
        </Modal>
      )}
    </div>
  );
}
