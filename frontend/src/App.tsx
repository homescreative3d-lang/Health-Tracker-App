import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, Check, LogOut, User, BookOpen } from "lucide-react";
import {
  api,
  type Dose,
  type Medicine,
  type Patient,
  type User as ApiUser,
  type Family,
  type Notification,
  type PatientAttachment,
} from "./api";
import { today, part } from "./lib/dates";
import { err } from "./lib/errors";
import { conditions, blank } from "./constants/options";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ResetScreen } from "./screens/auth/ResetScreen";
import { ForgotScreen } from "./screens/auth/ForgotScreen";
import { RoleScreen } from "./screens/onboarding/RoleScreen";
import { PatientScreen } from "./screens/onboarding/PatientScreen";
import { Hub } from "./screens/hub/Hub";
import { Profile } from "./screens/hub/Profile";
import { NotificationPopover } from "./screens/notifications/NotificationPopover";
import { NotificationDetailModal } from "./screens/notifications/NotificationDetailModal";
import { MedicineWizard } from "./screens/modals/MedicineWizard";
import { GuideModal } from "./screens/modals/GuideModal";

export default function App() {
  const [screen, setScreen] = useState<Screen>(
      new URLSearchParams(window.location.search).has("reset") ? "reset" : "login",
    ),
    [tab, setTab] = useState("today"),
    [user, setUser] = useState<ApiUser | null>(null),
    [patient, setPatient] = useState<Patient | null>(null),
    [patients, setPatients] = useState<Patient[]>([]),
    [meds, setMeds] = useState<Medicine[]>([]),
    [doses, setDoses] = useState<Dose[]>([]),
    [family, setFamily] = useState<Family[]>([]),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [selectedDate, setSelectedDate] = useState(today()),
    [toast, setToast] = useState<Toast | null>(null),
    [loading, setLoading] = useState(true),
    [wizard, setWizard] = useState(false),
    [editing, setEditing] = useState<Medicine | null>(null),
    [guide, setGuide] = useState(false),
    [accountMenu, setAccountMenu] = useState(false),
    [notificationOpen, setNotificationOpen] = useState(false),
    [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const flash = (message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3200);
  };
  const err = (e: unknown) =>
    e instanceof Error ? e.message : "Something went wrong. Please try again.";
  const load = async () => {
    try {
      const [u, p, ps, f, n] = await Promise.all([
        api.me(),
        api.getPatient(),
        api.getPatients(),
        api.getFamily(),
        api.getNotifications(),
      ]);
      setUser(u);
      const chosen = ps[0] || {
        id: "",
        name: "",
        dob: null,
        conditions: [],
        notes: "",
        mobile: "",
        doctor: "",
        medicalHistory: "",
        profileImageUrl: "",
      };
      setPatient(chosen);
      setPatients(ps);
      setFamily(f);
      setNotifications(n);
      setMeds(chosen.id ? await api.getMedicines(chosen.id) : []);
      setDoses(chosen.id ? await api.getDoses(selectedDate, chosen.id) : []);
      setSelectedDate(today());
      setTab("today");
      setScreen("hub");
      const params = new URLSearchParams(window.location.search);
      const doseId = params.get("doseId");
      const action = params.get("doseAction");
      if (doseId && (action === "taken" || action === "skip")) {
        history.replaceState(null, "", window.location.pathname);
        try {
          const updated =
            action === "taken"
              ? await api.take(doseId)
              : await api.skip(doseId, "Skipped from notification");
          setDoses((current) => current.map((d) => (d.id === updated.id ? updated : d)));
          flash(action === "taken" ? "Dose marked as taken" : "Dose marked as skipped");
        } catch (e) {
          flash(err(e), true);
        }
      }
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
      setPatient(null);
      setScreen("login");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    localStorage.getItem("access_token") ? load() : setLoading(false);
  }, []);
  useEffect(() => {
    if (user && patient)
      api
        .getDoses(selectedDate, patient.id)
        .then(setDoses)
        .catch((e) => flash(err(e), true));
  }, [selectedDate, user, patient]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () =>
      api
        .getNotifications()
        .then((items) => {
          if (active) setNotifications(items);
        })
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);
  const grouped = useMemo(
    () =>
      ["Morning", "Afternoon", "Evening", "Night"].map((s) => ({
        name: s,
        items: doses.filter((d) => part(d.time) === s),
      })),
    [doses],
  );
  const onAuth = async (r: { user: ApiUser; token: string }, isRegister: boolean) => {
    const params = new URLSearchParams(window.location.search);
    setLoading(true);
    setUser(null);
    setPatient(null);
    setPatients([]);
    setMeds([]);
    setDoses([]);
    setFamily([]);
    setNotifications([]);
    localStorage.setItem("access_token", r.token);
    try {
      const [p, ps, f, n] = await Promise.all([
        api.getPatient(),
        api.getPatients(),
        api.getFamily(),
        api.getNotifications(),
      ]);
      const chosen = ps[0] || {
        id: "",
        name: "",
        dob: null,
        conditions: [],
        notes: "",
        mobile: "",
        doctor: "",
        medicalHistory: "",
        profileImageUrl: "",
      };
      const nextMeds = chosen.id ? await api.getMedicines(chosen.id) : [];
      const nextDoses = chosen.id ? await api.getDoses(today(), chosen.id) : [];
      setPatient(chosen);
      setPatients(ps);
      setFamily(f);
      setNotifications(n);
      setMeds(nextMeds);
      setDoses(nextDoses);
      setSelectedDate(today());
      setTab("today");
      setWizard(false);
      setEditing(null);
      history.replaceState(null, "", window.location.pathname);
      setUser(r.user);
      setScreen("hub");
      const doseId = params.get("doseId");
      const action = params.get("doseAction");
      if (doseId && (action === "taken" || action === "skip")) {
        history.replaceState(null, "", window.location.pathname);
        try {
          const updated =
            action === "taken"
              ? await api.take(doseId)
              : await api.skip(doseId, "Skipped from notification");
          setDoses((current) => current.map((d) => (d.id === updated.id ? updated : d)));
          flash(action === "taken" ? "Dose marked as taken" : "Dose marked as skipped");
        } catch (e) {
          flash(err(e), true);
        }
      }
    } catch (e) {
      localStorage.removeItem("access_token");
      setUser(null);
      setPatient(null);
      setScreen("login");
      throw e;
    } finally {
      setLoading(false);
    }
  };
  const savePatient = async (v: {
    name: string;
    dob: string;
    conditions: string[];
    notes: string;
    relationship?: string;
    mobile?: string;
    doctor?: string;
    medicalHistory?: string;
    profileImageUrl?: string;
    doctorPhotoUrl?: string;
    attachments?: PatientAttachment[];
  }) => {
    try {
      const p = patient?.id ? await api.savePatient(v, patient.id) : await api.createPatient(v);
      setPatient(p);
      setPatients((x) =>
        x.some((a) => a.id === p.id) ? x.map((a) => (a.id === p.id ? p : a)) : [...x, p],
      );
      setScreen("hub");
      setTab("patientDetails");
      flash("Patient details saved");
      return true;
    } catch (e) {
      flash(err(e), true);
      return false;
    }
  };
  const doseAction = async (d: Dose, action: "taken" | "skip") => {
    try {
      const updated =
        action === "taken" ? await api.take(d.id) : await api.skip(d.id, "Skipped by user");
      setDoses((x) => x.map((v) => (v.id === updated.id ? updated : v)));
      flash(action === "taken" ? `${d.medName} marked as taken` : `${d.medName} skipped`);
    } catch (e) {
      flash(err(e), true);
    }
  };
  const saveMedicine = async (m: Omit<Medicine, "id">) => {
    try {
      if (editing) await api.updateMedicine(editing.id, m, patient!.id);
      else await api.createMedicine(m, patient!.id);
      setWizard(false);
      setEditing(null);
      setMeds(await api.getMedicines(patient!.id));
      setDoses(await api.getDoses(selectedDate, patient!.id));
      flash(editing ? `${m.name} updated` : `${m.name} added to your plan`);
    } catch (e) {
      flash(err(e), true);
    }
  };
  const removeMedicine = async (m: Medicine) => {
    if (!confirm(`Remove ${m.name} from your medicine plan?`)) return;
    try {
      await api.deleteMedicine(m.id, patient!.id);
      setMeds(await api.getMedicines(patient!.id));
      setDoses(await api.getDoses(selectedDate, patient!.id));
      flash(`${m.name} removed`);
    } catch (e) {
      flash(err(e), true);
    }
  };
  const pauseMedicine = async (id: string, start: string) => {
    try {
      await api.pauseMedicine(id, start);
      flash("Medicine paused from " + start);
      setMeds(await api.getMedicines(patient!.id));
      setDoses(await api.getDoses(selectedDate, patient!.id));
    } catch (e) {
      flash(err(e), true);
    }
  };
  if (loading)
    return (
      <div className="center">
        <div className="loading-mark">
          <img src="/tended-icon.svg" alt="" />
        </div>
        <p>Loading your care plan…</p>
      </div>
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            user && setTab("today");
          }}
        >
          <img className="brand-mark" src="/tended-icon.svg" alt="" />
          <span>TENDED</span>
        </a>
        {user && (
          <div className="top-actions">
            <button
              className="icon-btn notification-btn"
              title="Notifications"
              onClick={() => setNotificationOpen((v) => !v)}
            >
              <Bell size={19} />
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span className="notification-dot">
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </button>
            <button className="help-btn" onClick={() => setGuide(true)}>
              <BookOpen size={18} />
              <span>How it works</span>
            </button>
            <button
              className="avatar-mini avatar-button"
              title="Profile"
              onClick={() => {
                setNotificationOpen(false);
                setAccountMenu((v) => !v);
              }}
              aria-expanded={accountMenu}
            >
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" />
              ) : (
                (user.displayName || "?")
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")
              )}
            </button>
          </div>
        )}
      </header>
      {user && accountMenu && (
        <div className="account-dropdown" role="menu" aria-label="Account menu">
          <button
            role="menuitem"
            onClick={() => {
              setAccountMenu(false);
              setNotificationOpen(false);
              setTab("profile");
            }}
          >
            <User size={17} />
            <span>Profile</span>
          </button>
          <button
            role="menuitem"
            className="account-dropdown-signout"
            onClick={() => {
              setAccountMenu(false);
              localStorage.removeItem("access_token");
              history.replaceState(null, "", window.location.pathname);
              setUser(null);
              setPatient(null);
              setPatients([]);
              setMeds([]);
              setDoses([]);
              setFamily([]);
              setNotifications([]);
              setTab("today");
              setSelectedDate(today());
              setWizard(false);
              setEditing(null);
              setNotificationOpen(false);
              setGuide(false);
              setScreen("login");
            }}
          >
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      )}
      <main className="main">
        {screen === "login" && (
          <LoginScreen
            onSuccess={onAuth}
            onForgot={() => setScreen("forgot")}
            onError={(m) => flash(m, true)}
          />
        )}
        {screen === "forgot" && (
          <ForgotScreen onBack={() => setScreen("login")} onSent={(m) => flash(m)} />
        )}{" "}
        {screen === "reset" && (
          <ResetScreen
            onDone={(m) => {
              history.replaceState(null, "", "/");
              flash(m);
              setScreen("login");
            }}
          />
        )}
        {screen === "role" && (
          <RoleScreen
            onPick={(r) => {
              localStorage.setItem("role", r);
              setScreen("patient");
            }}
            onSkip={() => {
              localStorage.setItem("role", "self");
              setScreen("hub");
            }}
          />
        )}
        {screen === "patient" && patient && (
          <PatientScreen
            patient={patient}
            role={localStorage.getItem("role") || "caregiver"}
            onBack={() => {
              setScreen(user?.id ? "hub" : "role");
              if (user) setTab("patientDetails");
            }}
            onSave={async (v) => {
              await savePatient(v);
            }}
          />
        )}
        {screen === "hub" && patient && user && (
          <Hub
            user={user}
            patient={patient}
            patients={patients}
            tab={tab}
            setTab={setTab}
            grouped={grouped}
            meds={meds}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            onDose={doseAction}
            onAdd={() => {
              setEditing(null);
              setWizard(true);
            }}
            onEdit={(m) => {
              setEditing(m);
              setWizard(true);
            }}
            onDelete={removeMedicine}
            onEditPatient={() => setScreen("patient")}
            onSavePatient={savePatient}
            onAddPatient={() => {
              setPatient({
                id: "",
                name: "",
                dob: null,
                conditions: [],
                notes: "",
                mobile: "",
                doctor: "",
                medicalHistory: "",
                profileImageUrl: "",
              });
              setScreen("patient");
            }}
            onAddSelfPatient={() => {
              setPatient({
                id: "",
                name: user.displayName || "",
                dob: null,
                conditions: [],
                notes: "",
                mobile: "",
                doctor: "",
                medicalHistory: "",
                profileImageUrl: "",
                doctorPhotoUrl: "",
                relationship: "self",
              });
              localStorage.setItem("role", "self");
              setScreen("patient");
            }}
            onAccountSave={(u) => setUser(u)}
            onPause={pauseMedicine}
            family={family}
            notifications={notifications}
            onFamilyChange={async () => {
              setFamily(await api.getFamily());
              setNotifications(await api.getNotifications());
            }}
            onPatientSelect={async (p) => {
              setPatient(p);
              setMeds(await api.getMedicines(p.id));
              setDoses(await api.getDoses(selectedDate, p.id));
            }}
            onPatientView={async (p) => {
              setPatient(p);
              setMeds(await api.getMedicines(p.id));
              setDoses(await api.getDoses(selectedDate, p.id));
              setTab("patientDetails");
            }}
            onPatientEdit={async (p) => {
              setPatient(p);
              setMeds(await api.getMedicines(p.id));
              setDoses(await api.getDoses(selectedDate, p.id));
              setTab("patientDetailsEdit");
            }}
            onGuide={() => setGuide(true)}
            onDeleteAccount={async () => {
              try {
                await api.deleteAccount();
                localStorage.removeItem("access_token");
                history.replaceState(null, "", window.location.pathname);
                setUser(null);
                setPatient(null);
                setPatients([]);
                setMeds([]);
                setDoses([]);
                setFamily([]);
                setNotifications([]);
                setTab("today");
                setScreen("login");
                flash("Your account has been deleted.");
              } catch (e) {
                flash(err(e), true);
              }
            }}
          />
        )}
      </main>
      {guide && <GuideModal onClose={() => setGuide(false)} />}
      {notificationOpen && user && (
        <NotificationPopover
          notifications={notifications}
          patients={patients}
          onClose={() => setNotificationOpen(false)}
          onRead={async (id) => {
            await api.readNotification(id);
            setNotifications(await api.getNotifications());
          }}
          onSelect={async (n) => {
            setSelectedNotification(n);
            setNotificationOpen(false);
            if (!n.isRead) {
              try {
                await api.readNotification(n.id);
                setNotifications(await api.getNotifications());
              } catch (e) {
                flash(err(e), true);
              }
            }
          }}
        />
      )}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          patients={patients}
          onClose={() => setSelectedNotification(null)}
        />
      )}
      {wizard && (
        <MedicineWizard
          initial={editing || blank()}
          onClose={() => {
            setWizard(false);
            setEditing(null);
          }}
          onSave={saveMedicine}
        />
      )}
      {toast && (
        <div className={toast.error ? "toast error-toast" : "toast"}>
          <span>{toast.error ? <AlertCircle size={18} /> : <Check size={18} />}</span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

type Screen = "login" | "forgot" | "reset" | "role" | "patient" | "hub";

type Toast = { message: string; error?: boolean };
