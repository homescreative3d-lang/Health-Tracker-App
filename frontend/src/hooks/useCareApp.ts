import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  api,
  tokenStore,
  type AuthResult,
  type Dose,
  type Family,
  type Medicine,
  type MedicineInput,
  type Notification,
  type Patient,
  type PatientInput,
  type User,
} from "../api";
import { DAY_PARTS, dateLabel, fmtTime, part, today } from "../lib/dates";
import { err } from "../lib/errors";
import { HUB_TABS, type HubTab } from "../components/navigation/navItems";
import type { DoseAction } from "../components/DoseRow";
import { useHashRoute } from "./useHashRoute";
import { useToast } from "./useToast";

/** Top-level screens outside the signed-in hub. */
export type Screen = "landing" | "login" | "forgot" | "reset" | "role" | "patient" | "hub";

/** Placeholder used when the user has no patient yet, or when adding a new one. */
export const emptyPatient = (overrides: Partial<Patient> = {}): Patient => ({
  id: "",
  name: "",
  dob: null,
  conditions: [],
  notes: "",
  mobile: "",
  doctor: "",
  medicalHistory: "",
  profileImageUrl: "",
  doctorPhotoUrl: "",
  ...overrides,
});

const NOTIFICATION_POLL_MS = 20_000;
const DOSE_REFRESH_MS = 60_000;

/**
 * Application controller (the "container" in a container/presentational split).
 *
 * Owns session, patient selection, medicines, doses, family and notification state, plus
 * every action that changes them. Screens receive data and callbacks and stay presentational.
 * Previously this logic lived inline in a 600-line `App` component and was prop-drilled
 * through 21 props.
 */
export function useCareApp() {
  // Signed-out visitors start on the landing page; reset links open the reset form.
  const [screen, setScreen] = useState<Screen>(
    new URLSearchParams(window.location.search).has("reset") ? "reset" : "landing",
  );
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [planLoading, setPlanLoading] = useState(false);
  /** Id of the medicine just added or rescheduled, so its card can animate in. */
  const [justChangedMedicine, setJustChangedMedicine] = useState<string | null>(null);
  const [tab, setTab] = useHashRoute<HubTab>("today", HUB_TABS);
  const [user, setUser] = useState<User | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [doses, setDoses] = useState<Dose[]>([]);
  const [family, setFamily] = useState<Family[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [guide, setGuide] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [onboardingRole, setOnboardingRole] = useState<"self" | "caregiver">("caregiver");
  const { toast, flash, dismiss } = useToast();

  /** Clears every piece of signed-in state (used by sign-out, account deletion and expired sessions). */
  const resetSession = useCallback(() => {
    tokenStore.clear();
    history.replaceState(null, "", window.location.pathname);
    setUser(null);
    setPatient(null);
    setPatients([]);
    setMeds([]);
    setDoses([]);
    setFamily([]);
    setNotifications([]);
    setSelectedDate(today());
    setWizard(false);
    setEditing(null);
    setNotificationOpen(false);
    setGuide(false);
    setScreen("landing");
  }, []);

  /**
   * Reports an error; a 401 means the session expired, so the user is signed out.
   * @param e - Caught error.
   */
  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        resetSession();
        flash("Your session expired. Please log in again.", true);
        return;
      }
      flash(err(e), true);
    },
    [flash, resetSession],
  );

  /**
   * Applies a Take/Skip action requested from a push-notification link
   * (`?doseId=...&doseAction=taken|skip`), then clears the query string.
   */
  const applyDeepLinkAction = useCallback(
    async (params: URLSearchParams) => {
      const doseId = params.get("doseId");
      const action = params.get("doseAction");
      if (!doseId || (action !== "taken" && action !== "skip")) return;
      history.replaceState(null, "", window.location.pathname + window.location.hash);
      try {
        const updated =
          action === "taken"
            ? await api.take(doseId)
            : await api.skip(doseId, "Skipped from notification");
        setDoses((current) => current.map((d) => (d.id === updated.id ? updated : d)));
        flash(action === "taken" ? "Dose marked as taken" : "Dose marked as skipped");
      } catch (e) {
        fail(e);
      }
    },
    [fail, flash],
  );

  /**
   * Loads everything needed for the hub after sign-in or on page refresh.
   * Shared by both paths (previously duplicated).
   * @param knownUser - User returned by login/register; fetched from `/auth/me` when omitted.
   */
  const loadSession = useCallback(
    async (knownUser?: User) => {
      const params = new URLSearchParams(window.location.search);
      const [u, ps, f, n] = await Promise.all([
        knownUser ? Promise.resolve(knownUser) : api.me(),
        api.getPatients(),
        api.getFamily(),
        api.getNotifications(),
      ]);
      const chosen = ps[0] || emptyPatient();
      const day = today();
      const [nextMeds, nextDoses] = chosen.id
        ? await Promise.all([api.getMedicines(chosen.id), api.getDoses(day, chosen.id)])
        : [[], []];
      setUser(u);
      setPatient(chosen);
      setPatients(ps);
      setFamily(f);
      setNotifications(n);
      setMeds(nextMeds);
      setDoses(nextDoses);
      setSelectedDate(day);
      setWizard(false);
      setEditing(null);
      setScreen("hub");
      await applyDeepLinkAction(params);
    },
    [applyDeepLinkAction],
  );

  // Restore an existing session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false);
    loadSession()
      .catch(() => resetSession())
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reloads doses for the selected patient/date. */
  const refreshDoses = useCallback(
    async (date = selectedDate, patientId = patient?.id) => {
      if (!patientId) return setDoses([]);
      setDoses(await api.getDoses(date, patientId));
    },
    [patient?.id, selectedDate],
  );

  // Reload doses whenever the date or patient changes.
  useEffect(() => {
    if (user && patient?.id) refreshDoses().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, user?.id, patient?.id]);

  // The Today tab always shows today, even if the calendar was left on another date.
  useEffect(() => {
    if (tab === "today" && selectedDate !== today()) setSelectedDate(today());
  }, [tab, selectedDate]);

  // Refresh doses each minute so action windows (due/locked) and family changes stay current.
  useEffect(() => {
    if (!user || !patient?.id) return;
    const timer = window.setInterval(() => void refreshDoses().catch(() => {}), DOSE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [user, patient?.id, refreshDoses]);

  // Poll notifications while signed in.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = () =>
      api
        .getNotifications()
        .then((items) => active && setNotifications(items))
        .catch(() => {});
    const timer = window.setInterval(refresh, NOTIFICATION_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  /** Medicines that are current (records replaced by a reschedule are hidden but kept for history). */
  const activeMeds = useMemo(() => meds.filter((m) => !m.endedOn || m.endedOn > today()), [meds]);

  /** Doses grouped into daypart compartments. */
  const grouped = useMemo(
    () => DAY_PARTS.map((name) => ({ name, items: doses.filter((d) => part(d.time) === name) })),
    [doses],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ---------------------------------------------------------------- actions

  /**
   * Completes sign-in/registration: stores the token and loads the hub.
   * New accounts are sent to the "who is this for?" onboarding.
   * @param r - Auth result from the API.
   * @param isRegister - True for new accounts.
   */
  const onAuth = async (r: AuthResult, isRegister: boolean) => {
    setLoading(true);
    tokenStore.set(r.token);
    try {
      await loadSession(r.user);
      setTab("today");
      if (isRegister) setScreen("role");
    } catch (e) {
      resetSession();
      throw e;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Opens the auth screen on the requested tab (used by the landing navbar and CTAs).
   * @param mode - "signin" for Log in, "signup" for Sign up.
   */
  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setScreen("login");
    window.scrollTo({ top: 0 });
  };

  /** Signs out and returns to the landing page. */
  const signOut = () => {
    resetSession();
    window.location.hash = "";
  };

  /**
   * Creates or updates the focused patient.
   * @param v - Patient form values.
   * @returns True when saved (the form stays open on failure).
   */
  const savePatient = async (v: PatientInput): Promise<boolean> => {
    try {
      const p = patient?.id ? await api.savePatient(v, patient.id) : await api.createPatient(v);
      setPatient(p);
      setPatients((x) =>
        x.some((a) => a.id === p.id) ? x.map((a) => (a.id === p.id ? p : a)) : [...x, p],
      );
      if (!patient?.id) {
        setMeds([]);
        setDoses([]);
      }
      setScreen("hub");
      setTab("patientDetails");
      flash("Patient details saved");
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /**
   * Takes, skips or undoes a dose and updates it in place.
   * @param d - Dose to act on.
   * @param action - Requested action.
   */
  const doseAction = async (d: Dose, action: DoseAction) => {
    try {
      const updated =
        action === "taken"
          ? await api.take(d.id)
          : action === "skip"
            ? await api.skip(d.id, "Skipped by user")
            : await api.undo(d.id);
      setDoses((x) => x.map((v) => (v.id === updated.id ? updated : v)));
      if (action !== "skip") setMeds(await api.getMedicines(patient!.id)); // supply count changed
      flash(
        action === "taken"
          ? `${d.medName} marked as taken`
          : action === "skip"
            ? `${d.medName} skipped`
            : `${d.medName} reset to pending`,
      );
    } catch (e) {
      fail(e);
      // Server state may have moved on (e.g. window closed) — resync.
      refreshDoses().catch(() => {});
    }
  };

  /** Reloads medicines and doses after a plan change. */
  const reloadPlan = async () => {
    if (!patient?.id) return;
    const [m, d] = await Promise.all([
      api.getMedicines(patient.id),
      api.getDoses(selectedDate, patient.id),
    ]);
    setMeds(m);
    setDoses(d);
  };

  /**
   * Creates or updates a medicine from the wizard.
   * @param m - Medicine form values.
   * @throws Re-throws so the wizard can keep its busy state accurate.
   */
  const saveMedicine = async (m: MedicineInput) => {
    try {
      const saved = editing
        ? await api.updateMedicine(editing.id, m, patient!.id)
        : await api.createMedicine(m, patient!.id);
      setJustChangedMedicine(saved.id);
      flash(editing ? `${m.name} updated` : `${m.name} added to the plan`);
      setWizard(false);
      setEditing(null);
      await reloadPlan();
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Deletes a medicine after confirmation.
   * @param m - Medicine to remove.
   */
  const removeMedicine = async (m: Medicine) => {
    if (!confirm(`Remove ${m.name} from the medicine plan? Past history is kept.`)) return;
    try {
      await api.deleteMedicine(m.id, patient!.id);
      flash(`${m.name} removed`);
      await reloadPlan();
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Moves one dose to another date/time. The original shows "Moved to …" and the new dose carries
   * a Rescheduled badge; the care team is notified by the API.
   * @param d - Dose to move.
   * @param date - Target date (`YYYY-MM-DD`).
   * @param time - Target time (`HH:mm`).
   * @returns True on success (the dialog closes).
   */
  const rescheduleDose = async (d: Dose, date: string, time: string): Promise<boolean> => {
    try {
      await api.rescheduleDose(d.id, date, time);
      flash(`${d.medName} moved to ${dateLabel(date)} at ${fmtTime(time)}`);
      await refreshDoses();
      setNotifications(await api.getNotifications());
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /**
   * Changes a medicine's dose times from a date onwards (earlier history stays on the old record).
   * @param m - Medicine to reschedule.
   * @param effectiveDate - First date of the new schedule.
   * @param times - New dose times.
   * @returns True on success.
   */
  const rescheduleMedicine = async (
    m: Medicine,
    effectiveDate: string,
    times: string[],
  ): Promise<boolean> => {
    try {
      const updated = await api.rescheduleMedicine(m.id, effectiveDate, times);
      setJustChangedMedicine(updated.id);
      flash(`${m.name} rescheduled from ${dateLabel(effectiveDate)}`);
      await reloadPlan();
      setNotifications(await api.getNotifications());
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  /**
   * Pauses a medicine from a date.
   * @param id - Medicine id.
   * @param start - First paused date (`YYYY-MM-DD`).
   */
  const pauseMedicine = async (id: string, start: string) => {
    try {
      await api.pauseMedicine(id, start);
      flash("Medicine paused from " + start);
      await reloadPlan();
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Resumes a paused medicine as of today (previously had no UI).
   * @param m - Medicine to resume.
   */
  const resumeMedicine = async (m: Medicine) => {
    try {
      await api.resumeMedicine(m.id);
      flash(`${m.name} resumed`);
      await reloadPlan();
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Focuses a different patient and loads their plan.
   * @param p - Patient to focus.
   * @param nextTab - Optional view to open afterwards.
   */
  const selectPatient = async (p: Patient, nextTab?: HubTab) => {
    setPlanLoading(true);
    try {
      setPatient(p);
      if (nextTab) setTab(nextTab);
      const [m, d] = await Promise.all([api.getMedicines(p.id), api.getDoses(selectedDate, p.id)]);
      setMeds(m);
      setDoses(d);
    } catch (e) {
      fail(e);
    } finally {
      setPlanLoading(false);
    }
  };

  /**
   * Opens the patient form for a new patient.
   * @param self - True to create the user's own health profile.
   */
  const startAddPatient = (self = false) => {
    setOnboardingRole(self ? "self" : "caregiver");
    setPatient(emptyPatient(self ? { name: user?.displayName || "", relationship: "self" } : {}));
    setScreen("patient");
  };

  /**
   * Handles the onboarding choice for new accounts. Registration already creates an empty
   * patient record, so the form edits that record instead of creating a duplicate.
   * @param role - Who the plan is for; `null` skips onboarding.
   */
  const chooseRole = (role: "self" | "caregiver" | null) => {
    if (!role) return setScreen("hub");
    setOnboardingRole(role);
    if (role === "self" && patient && !patient.name)
      setPatient({ ...patient, name: user?.displayName || "", relationship: "self" });
    setScreen("patient");
  };

  /** Leaves the patient form, restoring the previously focused patient if adding was cancelled. */
  const cancelPatientForm = () => {
    if (!patient?.id) setPatient(patients[0] || emptyPatient());
    setScreen("hub");
  };

  /** Opens the medicine wizard (new medicine, or editing an existing one). */
  const openWizard = (m: Medicine | null = null) => {
    setEditing(m);
    setWizard(true);
  };

  /** Closes the medicine wizard without saving. */
  const closeWizard = () => {
    setWizard(false);
    setEditing(null);
  };

  /** Reloads family membership and notifications after an invite/response. */
  const refreshFamily = async () => {
    const [f, n] = await Promise.all([api.getFamily(), api.getNotifications()]);
    setFamily(f);
    setNotifications(n);
  };

  /**
   * Marks a notification read.
   * @param id - Notification id.
   */
  const readNotification = async (id: string) => {
    try {
      await api.readNotification(id);
      setNotifications((x) => x.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {
      fail(e);
    }
  };

  /** Marks every notification read. */
  const readAllNotifications = async () => {
    try {
      await api.readAllNotifications();
      setNotifications((x) => x.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      fail(e);
    }
  };

  /**
   * Opens a notification's detail dialog and marks it read.
   * @param n - Notification selected in the popover.
   */
  const openNotification = (n: Notification) => {
    setSelectedNotification(n);
    setNotificationOpen(false);
    if (!n.isRead) void readNotification(n.id);
  };

  /** Deletes the account and signs out. */
  const deleteAccount = async () => {
    try {
      await api.deleteAccount();
      signOut();
      flash("Your account has been deleted.");
    } catch (e) {
      fail(e);
    }
  };

  return {
    // state
    screen,
    setScreen,
    authMode,
    openAuth,
    planLoading,
    tab,
    setTab,
    user,
    setUser,
    patient,
    patients,
    meds: activeMeds,
    allMeds: meds,
    doses,
    grouped,
    family,
    notifications,
    unreadCount,
    selectedDate,
    setSelectedDate,
    loading,
    wizard,
    editing,
    guide,
    setGuide,
    notificationOpen,
    setNotificationOpen,
    selectedNotification,
    setSelectedNotification,
    onboardingRole,
    toast,
    flash,
    dismissToast: dismiss,
    // actions
    onAuth,
    signOut,
    savePatient,
    doseAction,
    saveMedicine,
    removeMedicine,
    pauseMedicine,
    resumeMedicine,
    rescheduleDose,
    rescheduleMedicine,
    justChangedMedicine,
    selectPatient,
    startAddPatient,
    cancelPatientForm,
    chooseRole,
    openWizard,
    closeWizard,
    refreshFamily,
    readNotification,
    readAllNotifications,
    openNotification,
    deleteAccount,
    fail,
  };
}

/** The controller's public shape, shared through context. */
export type CareApp = ReturnType<typeof useCareApp>;
