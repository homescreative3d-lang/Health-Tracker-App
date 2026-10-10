import { ArrowLeft, BookOpen } from "lucide-react";
import { useCare } from "../../hooks/CareAppContext";
import { AppNav } from "../../components/navigation/AppNav";
import { PageHeader } from "../../components/PageHeader";
import { PatientContextBar } from "../../components/PatientContextBar";
import { plural } from "../../lib/text";
import { Today } from "./Today";
import { Calendar } from "./Calendar";
import { Medicines } from "./Medicines";
import { History } from "./History";
import { Profile } from "./Profile";
import { AccountDetails } from "./AccountDetails";
import { PatientDetails } from "./PatientDetails";
import { FamilyManagement } from "./FamilyManagement";
import { NotificationSettings } from "../notifications/NotificationSettings";
import { NotificationInbox } from "../notifications/NotificationInbox";

/** Views that act on a single patient and therefore show the patient switcher. */
const PATIENT_SCOPED = ["calendar", "medicines", "patientDetails", "patientDetailsEdit"];

/**
 * Signed-in workspace: navigation + the active view.
 * Acts as the container that maps controller state/actions to presentational screens.
 */
export function Hub() {
  const app = useCare();
  const { tab, setTab, user, patient, patients, meds } = app;
  if (!user || !patient) return null;
  const backToProfile = (
    <button className="btn soft" onClick={() => setTab("profile")}>
      <ArrowLeft size={16} aria-hidden="true" />
      Back to profile
    </button>
  );

  return (
    <>
      <div className="dashboard">
        <aside className="sidebar">
          <div className="side-intro">
            <small>Care plan</small>
            <b>{patient.name || "No patient yet"}</b>
            <span className="muted">
              {plural(meds.length, "medicine")} · {plural(app.doses.length, "dose")}
            </span>
          </div>
          <AppNav
            tab={tab}
            onNavigate={setTab}
            variant="side"
            footer={
              <button className="guide-link" onClick={() => app.setGuide(true)}>
                <BookOpen size={18} aria-hidden="true" />
                <span>How to use Tended</span>
              </button>
            }
          />
        </aside>
        <div className="dashboard-main">
          {PATIENT_SCOPED.includes(tab) && patient.id && (
            <PatientContextBar
              patient={patient}
              patients={patients}
              onSelect={(p) => app.selectPatient(p)}
            />
          )}
          <div className="view" key={tab}>
            {tab === "today" && (
              <Today
                patient={patient}
                patients={patients}
                onPatientSelect={(p) => app.selectPatient(p)}
                grouped={app.grouped}
                meds={meds}
                date={app.selectedDate}
                onDose={app.doseAction}
                onAdd={() => app.openWizard()}
                onAddPatient={() => app.startAddPatient()}
                onPatientInfo={() => setTab("patientDetails")}
                loading={app.planLoading}
              />
            )}
            {tab === "calendar" && (
              <Calendar
                selectedDate={app.selectedDate}
                setSelectedDate={app.setSelectedDate}
                grouped={app.grouped}
                meds={meds}
                onPause={app.pauseMedicine}
                onDose={app.doseAction}
              />
            )}
            {tab === "medicines" && (
              <Medicines
                meds={meds}
                hasPatient={!!patient.id}
                onAdd={() => app.openWizard()}
                onAddPatient={() => app.startAddPatient()}
                onEdit={(m) => app.openWizard(m)}
                onDelete={app.removeMedicine}
                onResume={app.resumeMedicine}
                loading={app.planLoading}
              />
            )}
            {tab === "history" && <History patients={patients} patient={patient} />}
            {tab === "profile" && (
              <Profile
                user={user}
                patients={patients}
                setTab={setTab}
                onPatientView={(p) => app.selectPatient(p, "patientDetails")}
                onPatientEdit={(p) => app.selectPatient(p, "patientDetailsEdit")}
                onAddPatient={() => app.startAddPatient()}
                onAddSelfPatient={() => app.startAddPatient(true)}
                onGuide={() => app.setGuide(true)}
                onDeleteAccount={app.deleteAccount}
              />
            )}
            {tab === "profileDetails" && (
              <AccountDetails
                user={user}
                onBack={() => setTab("profile")}
                onSave={(u) => {
                  app.setUser(u);
                  app.flash("Your details were saved");
                  setTab("profile");
                }}
              />
            )}
            {(tab === "patientDetails" || tab === "patientDetailsEdit") && (
              <PatientDetails
                patient={patient}
                meds={meds}
                startEditing={tab === "patientDetailsEdit"}
                onBack={() => setTab("profile")}
                onSave={app.savePatient}
                onAddPatient={() => app.startAddPatient()}
              />
            )}
            {tab === "family" && (
              <div className="page-scroll">
                <PageHeader
                  kicker="Shared care"
                  title="Family"
                  description="Invite trusted people. They see patients only after accepting."
                  actions={backToProfile}
                />
                <FamilyManagement
                  family={app.family}
                  notifications={app.notifications}
                  onChange={app.refreshFamily}
                />
              </div>
            )}
            {tab === "notifications" && (
              <div className="page-scroll">
                <PageHeader
                  kicker="Reminders"
                  title="Notification settings"
                  description="Choose when reminders arrive and turn on alerts for this device."
                  actions={backToProfile}
                />
                <NotificationSettings />
                <NotificationInbox notifications={app.notifications} />
              </div>
            )}
          </div>
        </div>
      </div>
      <AppNav tab={tab} onNavigate={setTab} variant="bottom" />
    </>
  );
}
