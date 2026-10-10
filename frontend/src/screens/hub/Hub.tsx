import { ArrowLeft, CalendarDays, Home, Pill, User, BookOpen, Clock3 } from "lucide-react";
import {
  type Dose,
  type Medicine,
  type Patient,
  type User as ApiUser,
  type Family,
  type Notification,
} from "../../api";
import { today } from "../../lib/dates";
import { PatientContextBar } from "../../components/PatientContextBar";
import { SideTab } from "../../components/navigation/SideTab";
import { Tab } from "../../components/navigation/Tab";
import { Today } from "./Today";
import { Calendar } from "./Calendar";
import { Medicines } from "./Medicines";
import { Profile } from "./Profile";
import { AccountDetails } from "./AccountDetails";
import { PatientDetails } from "./PatientDetails";
import { History } from "./History";
import { FamilyManagement } from "./FamilyManagement";
import { NotificationInbox } from "../notifications/NotificationInbox";
import { NotificationSettings } from "../notifications/NotificationSettings";

export function Hub({
  user,
  patient,
  patients,
  tab,
  setTab,
  grouped,
  meds,
  selectedDate,
  setSelectedDate,
  onDose,
  onAdd,
  onEdit,
  onDelete,
  onEditPatient,
  onSavePatient,
  onAddPatient,
  onAddSelfPatient,
  onAccountSave,
  onPause,
  family,
  notifications,
  onFamilyChange,
  onPatientSelect,
  onPatientView,
  onPatientEdit,
  onGuide,
  onDeleteAccount,
}: {
  user: ApiUser;
  patient: Patient;
  patients: Patient[];
  tab: string;
  setTab: (v: string) => void;
  grouped: { name: string; items: Dose[] }[];
  meds: Medicine[];
  selectedDate: string;
  setSelectedDate: (v: string) => void;
  onDose: (d: Dose, a: "taken" | "skip") => void;
  onAdd: () => void;
  onEdit: (m: Medicine) => void;
  onDelete: (m: Medicine) => void;
  onEditPatient: () => void;
  onSavePatient: (v: any) => Promise<boolean>;
  onAddPatient: () => void;
  onAddSelfPatient: () => void;
  onAccountSave: (u: ApiUser) => void;
  onPause: (id: string, start: string) => Promise<void>;
  family: Family[];
  notifications: Notification[];
  onFamilyChange: () => Promise<void>;
  onPatientSelect: (p: Patient) => Promise<void>;
  onPatientView: (p: Patient) => Promise<void>;
  onPatientEdit: (p: Patient) => Promise<void>;
  onGuide: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  return (
    <>
      <div className="dashboard">
        <aside className="sidebar">
          <div className="side-intro">
            <span className="eyebrow">YOUR CARE PLAN</span>
            <h2>{patient.name || "My plan"}</h2>
            <p className="muted">
              {meds.length} medicine{meds.length !== 1 ? "s" : ""} ·{" "}
              {grouped.reduce((n, g) => n + g.items.length, 0)} doses
            </p>
          </div>
          <nav>
            <SideTab
              icon={<Home />}
              label="Today"
              active={tab === "today"}
              onClick={() => setTab("today")}
            />
            <SideTab
              icon={<CalendarDays />}
              label="Calendar"
              active={tab === "calendar"}
              onClick={() => setTab("calendar")}
            />
            <SideTab
              icon={<Pill />}
              label="Medicines"
              active={tab === "medicines"}
              onClick={() => setTab("medicines")}
            />
            <SideTab
              icon={<Clock3 />}
              label="History"
              active={tab === "history"}
              onClick={() => setTab("history")}
            />
            <SideTab
              icon={<User />}
              label="Profile"
              active={tab === "profile"}
              onClick={() => setTab("profile")}
            />
          </nav>
          <button className="guide-link" onClick={onGuide}>
            <BookOpen size={18} />
            How to use TENDED
          </button>
        </aside>
        <div className="dashboard-main">
          {["calendar", "medicines", "history", "patientDetails", "patientDetailsEdit"].includes(
            tab,
          ) && (
            <PatientContextBar patient={patient} patients={patients} onSelect={onPatientSelect} />
          )}{" "}
          {tab === "today" && (
            <Today
              patient={patient}
              patients={patients}
              onPatientSelect={onPatientSelect}
              grouped={grouped}
              meds={meds}
              onDose={onDose}
              onAdd={onAdd}
              onAddPatient={onAddPatient}
              onGuide={onGuide}
              onPatientInfo={() => setTab("patientDetails")}
            />
          )}{" "}
          {tab === "calendar" && (
            <Calendar
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              grouped={grouped}
              meds={meds}
              onPause={onPause}
            />
          )}{" "}
          {tab === "medicines" && (
            <Medicines meds={meds} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
          )}{" "}
          {tab === "history" && <History patients={patients} patient={patient} />}{" "}
          {tab === "profile" && (
            <Profile
              user={user}
              patients={patients}
              setTab={setTab}
              onPatientView={onPatientView}
              onPatientEdit={onPatientEdit}
              onAddPatient={onAddPatient}
              onAddSelfPatient={onAddSelfPatient}
              onGuide={onGuide}
              onDeleteAccount={onDeleteAccount}
            />
          )}{" "}
          {tab === "profileDetails" && (
            <AccountDetails
              user={user}
              onBack={() => setTab("profile")}
              onSave={(u) => {
                onAccountSave(u);
                setTab("profile");
              }}
              title="Edit profile details"
            />
          )}{" "}
          {tab === "careDetails" && (
            <AccountDetails
              user={user}
              onBack={() => setTab("profile")}
              onSave={(u) => {
                onAccountSave(u);
                setTab("profile");
              }}
              title="Edit care giver details"
            />
          )}{" "}
          {(tab === "patientDetails" || tab === "patientDetailsEdit") && (
            <PatientDetails
              patient={patient}
              meds={meds}
              startEditing={tab === "patientDetailsEdit"}
              onBack={() => setTab("profile")}
              onSave={onSavePatient}
            />
          )}{" "}
          {tab === "family" && (
            <div className="page-scroll">
              <div className="page-head">
                <div>
                  <span className="eyebrow">SHARED CARE</span>
                  <h1>Family management</h1>
                  <p className="muted">Manage trusted people and consent.</p>
                </div>
                <button className="btn soft" onClick={() => setTab("profile")}>
                  <ArrowLeft size={16} />
                  Back to profile
                </button>
              </div>
              <FamilyManagement
                family={family}
                notifications={notifications}
                onChange={onFamilyChange}
              />
            </div>
          )}{" "}
          {tab === "notifications" && (
            <div className="page-scroll">
              <div className="page-head">
                <div>
                  <span className="eyebrow">REMINDERS</span>
                  <h1>Notification settings</h1>
                  <p className="muted">Control reminders and browser delivery.</p>
                </div>
                <button className="btn soft" onClick={() => setTab("profile")}>
                  <ArrowLeft size={16} />
                  Back to profile
                </button>
              </div>
              <NotificationSettings />
              <NotificationInbox notifications={notifications} />
            </div>
          )}
        </div>
      </div>
      <nav className="mobile-tabs">
        <Tab
          icon={<Home />}
          label="Today"
          active={tab === "today"}
          onClick={() => setTab("today")}
        />
        <Tab
          icon={<CalendarDays />}
          label="Calendar"
          active={tab === "calendar"}
          onClick={() => setTab("calendar")}
        />
        <Tab
          icon={<Pill />}
          label="Medicines"
          active={tab === "medicines"}
          onClick={() => setTab("medicines")}
        />
        <Tab
          icon={<Clock3 />}
          label="History"
          active={tab === "history"}
          onClick={() => setTab("history")}
        />
        <Tab
          icon={<User />}
          label="Profile"
          active={tab === "profile"}
          onClick={() => setTab("profile")}
        />
      </nav>
    </>
  );
}
