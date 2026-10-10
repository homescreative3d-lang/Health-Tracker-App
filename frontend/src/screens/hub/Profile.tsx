import {
  Bell,
  ChevronRight,
  HeartPulse,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
  BookOpen,
  ShieldAlert,
} from "lucide-react";
import { type Patient, type User as ApiUser, type Family, type Notification } from "../../api";

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
}: {
  user: ApiUser;
  patients: Patient[];
  setTab: (v: string) => void;
  onPatientView: (p: Patient) => Promise<void>;
  onPatientEdit: (p: Patient) => Promise<void>;
  onAddPatient: () => void;
  onAddSelfPatient: () => void;
  onGuide: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  const initials = (user.displayName || "?")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
  const caredFor = patients.filter((p) => p.relationship !== "self");
  const ownPlans = patients.filter((p) => p.relationship === "self");
  return (
    <div className="page-scroll profile-page">
      <div className="page-head">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Your profile</h1>
          <p className="muted">
            Personal information, people you care for, and your own health details.
          </p>
        </div>
      </div>
      <section className="card profile-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PERSONAL INFO</span>
            <h3>Personal information</h3>
            <p className="muted">Your account and caregiver details.</p>
          </div>
          <User />
        </div>
        <div className="profile-head">
          {user.profileImageUrl ? (
            <img className="avatar" src={user.profileImageUrl} alt="Profile" />
          ) : (
            <div className="avatar">{initials}</div>
          )}
          <div>
            <b>{user.displayName}</b>
            <span className="muted">{user.email}</span>
            <span className="profile-role">Caregiver account</span>
          </div>
        </div>
        <div className="profile-actions-grid">
          <button className="profile-action" onClick={() => setTab("profileDetails")}>
            <span className="profile-action-icon">
              <User size={20} />
            </span>
            <span>
              <b>Edit personal info</b>
              <small>Update your name and profile photo</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="profile-action" onClick={() => setTab("careDetails")}>
            <span className="profile-action-icon">
              <HeartPulse size={20} />
            </span>
            <span>
              <b>Caregiver details</b>
              <small>Your details as the person providing care</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="profile-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CAREGIVER</span>
            <h3>People I care for</h3>
            <p className="muted">Patient profiles you manage on behalf of someone else.</p>
          </div>
          <button className="btn accent" onClick={onAddPatient}>
            <Plus size={16} />
            Add patient
          </button>
        </div>
        {caredFor.length ? (
          <div className="patient-cards">
            {caredFor.map((p) => (
              <div className="patient-summary-row" key={p.id}>
                <button className="patient-summary-card" onClick={() => onPatientView(p)}>
                  <span className="avatar">
                    {p.profileImageUrl ? (
                      <img src={p.profileImageUrl} alt="" />
                    ) : (
                      (p.name || "?")
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")
                    )}
                  </span>
                  <span className="patient-summary-copy">
                    <b>{p.name || "Unnamed patient"}</b>
                    <small>{p.relationship || "Patient"}</small>
                  </span>
                  <span className="patient-open-label">
                    View details <ChevronRight size={15} />
                  </span>
                </button>
                <button
                  className="patient-edit-shortcut"
                  title={"Edit " + (p.name || "patient")}
                  aria-label={"Edit " + (p.name || "patient")}
                  onClick={() => onPatientEdit(p)}
                >
                  <Pencil size={17} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="card empty-card compact">
            <Users size={25} />
            <b>No one added yet</b>
            <span className="muted">
              Add a patient to manage their medicine schedule and history.
            </span>
          </div>
        )}
      </section>
      <section className="profile-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR OWN CARE</span>
            <h3>My health profile</h3>
            <p className="muted">
              Keep your own medical history separate from the people you care for.
            </p>
          </div>
          <HeartPulse />
        </div>
        {ownPlans.length ? (
          ownPlans.map((p) => (
            <div className="patient-summary-row own-health-row" key={p.id}>
              <button className="own-health-card card" onClick={() => onPatientView(p)}>
                <span className="own-health-avatar">
                  {p.profileImageUrl ? <img src={p.profileImageUrl} alt="" /> : <User size={22} />}
                </span>
                <span className="own-health-copy">
                  <b>{p.name || user.displayName}</b>
                  <small>
                    {p.medicalHistory || "Add your medical history and doctor details."}
                  </small>
                  {p.doctorPhotoUrl && (
                    <span className="doctor-photo-thumb">
                      <img src={p.doctorPhotoUrl} alt="Doctor or prescriber" />
                    </span>
                  )}
                </span>
                <span className="patient-open-label">
                  View details <ChevronRight size={15} />
                </span>
              </button>
              <button
                className="patient-edit-shortcut"
                title={"Edit " + (p.name || "health profile")}
                aria-label={"Edit " + (p.name || "health profile")}
                onClick={() => onPatientEdit(p)}
              >
                <Pencil size={17} />
              </button>
            </div>
          ))
        ) : (
          <div className="self-care-prompt">
            <div>
              <b>Do you manage your own medication too?</b>
              <p className="muted">
                Create a personal patient profile to store your medical history and prescriber
                photo.
              </p>
            </div>
            <button className="btn soft" onClick={onAddSelfPatient}>
              <Plus size={16} />
              Add my health profile
            </button>
          </div>
        )}
      </section>
      <section className="card profile-section profile-tools">
        <div className="profile-actions-grid">
          <button className="profile-action" onClick={() => setTab("family")}>
            <span className="profile-action-icon">
              <Users size={20} />
            </span>
            <span>
              <b>Family management</b>
              <small>Members, invitations and consent</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="profile-action" onClick={() => setTab("notifications")}>
            <span className="profile-action-icon">
              <Bell size={20} />
            </span>
            <span>
              <b>Notification settings</b>
              <small>Reminders and browser notifications</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="profile-action" onClick={onGuide}>
            <span className="profile-action-icon">
              <BookOpen size={20} />
            </span>
            <span>
              <b>How to use TENDED</b>
              <small>Learn the basics</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section className="card delete-account-section">
        <div className="delete-account-copy">
          <span className="delete-account-icon">
            <ShieldAlert size={20} />
          </span>
          <div>
            <h3>Delete account</h3>
            <p className="muted">
              Deletion is allowed only when no doses are pending, or every patient you manage has
              another approved family caregiver. When possible, care plans are transferred so
              reminders can continue.
            </p>
          </div>
        </div>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Permanently delete your TENDED account? This cannot be undone."))
              void onDeleteAccount();
          }}
        >
          <Trash2 size={16} />
          Delete my account
        </button>
      </section>
    </div>
  );
}
