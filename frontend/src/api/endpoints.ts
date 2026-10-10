import { request, send } from "./client";
import type {
  AuthResult,
  Dose,
  Family,
  FamilyUser,
  HistoryRow,
  Medicine,
  MedicineInput,
  Notification,
  NotificationSettingsData,
  Patient,
  PatientInput,
  User,
} from "./types";

/** Appends `?patientId=` when a patient is selected. */
const withPatient = (path: string, patientId?: string) =>
  patientId ? `${path}?patientId=${encodeURIComponent(patientId)}` : path;

/**
 * Typed wrapper for every API endpoint, grouped by feature.
 * Each method maps 1:1 to a route documented in Swagger (`/swagger`).
 */
export const api = {
  // ---- Authentication ----
  /** Creates an account and returns a signed-in session. */
  register: (b: { email: string; password: string; displayName: string }) =>
    request<AuthResult>("/auth/register", send("POST", b), false),
  /** Signs in with email and password. */
  login: (b: { email: string; password: string }) =>
    request<AuthResult>("/auth/login", send("POST", b), false),
  /** Returns the signed-in user; fails with 401 when the token is invalid. */
  me: () => request<User>("/auth/me"),
  /** Emails a password-reset link (always succeeds to avoid account enumeration). */
  forgotPassword: (email: string) =>
    request<{ message: string }>("/password/forgot", send("POST", { email }), false),
  /** Sets a new password using the token from the reset link. */
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/password/reset", send("POST", { token, newPassword }), false),

  // ---- Account ----
  /** Updates display name and profile photo (data URL, existing key, or empty to remove). */
  updateProfile: (b: { displayName: string; profileImageUrl: string }) =>
    request<User>("/account/profile", send("PUT", b)),
  /** Permanently deletes the account, transferring patients to a caregiver when possible. */
  deleteAccount: () => request<{ message: string }>("/account", send("DELETE")),

  // ---- Patients ----
  /** Returns the user's first own patient (legacy single-patient endpoint). */
  getPatient: () => request<Patient>("/patient"),
  /** Returns every patient the user can access (own + approved family). */
  getPatients: () => request<Patient[]>("/patient/all"),
  /** Creates a patient owned by the signed-in user. */
  createPatient: (b: PatientInput) => request<Patient>("/patient", send("POST", b)),
  /** Updates a patient the user can access. */
  savePatient: (b: PatientInput, id?: string) =>
    request<Patient>(id ? "/patient/" + id : "/patient", send("PUT", b)),

  // ---- Medicines ----
  /** Lists medicines for a patient. */
  getMedicines: (patientId?: string) => request<Medicine[]>(withPatient("/medicines", patientId)),
  /** Adds a medicine to a patient's plan. */
  createMedicine: (b: MedicineInput, patientId?: string) =>
    request<Medicine>(withPatient("/medicines", patientId), send("POST", b)),
  /** Updates a medicine. */
  updateMedicine: (id: string, b: MedicineInput, patientId?: string) =>
    request<Medicine>(withPatient("/medicines/" + id, patientId), send("PUT", b)),
  /** Removes a medicine and its future schedule. */
  deleteMedicine: (id: string, patientId?: string) =>
    request<void>(withPatient("/medicines/" + id, patientId), send("DELETE")),
  /** Pauses doses from `startDate` (optionally until `endDate`). */
  pauseMedicine: (id: string, startDate: string, endDate?: string) =>
    request<unknown>(
      `/medicine-actions/${id}/pause`,
      send("POST", { startDate, endDate: endDate || null }),
    ),
  /** Changes a medicine's dose times from a date onwards (history is kept); returns the new record. */
  rescheduleMedicine: (id: string, effectiveDate: string, times: string[]) =>
    request<Medicine>(`/medicine-actions/${id}/reschedule`, send("POST", { effectiveDate, times })),
  /** Ends an active pause as of today. */
  resumeMedicine: (id: string) => request<unknown>(`/medicine-actions/${id}/resume`, send("POST")),

  // ---- Doses ----
  /** Returns (and lazily materializes) the doses scheduled on a date. */
  getDoses: (date: string, patientId?: string) =>
    request<Dose[]>(`/doses?date=${date}` + (patientId ? `&patientId=${patientId}` : "")),
  /** Marks a dose taken (allowed from scheduled time until +1 hour). */
  take: (id: string) => request<Dose>(`/doses/${id}/taken`, send("POST")),
  /** Marks a dose skipped with a reason (same window as take). */
  skip: (id: string, reason: string) =>
    request<Dose>(`/doses/${id}/skip`, send("POST", { reason })),
  /** Moves one dose to another date/time; returns the new (moved) dose. */
  rescheduleDose: (id: string, date: string, time?: string) =>
    request<Dose>(`/doses/${id}/reschedule`, send("POST", { date, time })),
  /** Reverts a taken/skipped/rescheduled dose back to pending. */
  undo: (id: string) => request<Dose>(`/doses/${id}/undo`, send("POST")),

  // ---- History ----
  /** Queries dose history; `q` is a prebuilt query string beginning with `?`. */
  getHistory: (q: string) => request<HistoryRow[]>("/history" + q),

  // ---- Family ----
  /** Searches registered users by name or email (min 2 characters). */
  familySearch: (q: string) => request<FamilyUser[]>("/family/search?q=" + encodeURIComponent(q)),
  /** Returns the user's family with members and pending invitations. */
  getFamily: () => request<Family[]>("/family"),
  /** Creates a family owned by the user. */
  createFamily: (name: string) =>
    request<{ id: string; name: string }>("/family", send("POST", { name })),
  /** Invites a registered user; access is shared only after they accept. */
  inviteFamilyMember: (userId: string) => request<any>("/family/invite", send("POST", { userId })),
  /** Accepts or rejects an invitation addressed to the user. */
  respondFamilyInvite: (id: string, accept: boolean) =>
    request<{ status: string }>(`/family/invites/${id}/respond`, send("POST", { accept })),

  // ---- Notifications ----
  /** Lists notifications from the last three days. */
  getNotifications: () => request<Notification[]>("/notifications"),
  /** Marks one notification read. */
  readNotification: (id: string) => request<unknown>(`/notifications/${id}/read`, send("POST")),
  /** Marks every notification read. */
  readAllNotifications: () => request<{ updated: number }>("/notifications/read-all", send("POST")),
  /** Returns reminder timing settings and the VAPID public key. */
  getNotificationSettings: () => request<NotificationSettingsData>("/notifications/settings"),
  /** Saves reminder timing settings. */
  saveNotificationSettings: (b: NotificationSettingsData) =>
    request<NotificationSettingsData>("/notifications/settings", send("PUT", b)),
  /** Registers this browser's push subscription. */
  subscribePush: (b: { endpoint: string; p256dh: string; auth: string }) =>
    request<unknown>("/notifications/push/subscribe", send("POST", b)),
  /** Sends a test push to the user's subscribed devices. */
  testPush: () =>
    request<{ status: string; message: string }>("/notifications/push/test", send("POST")),
};
