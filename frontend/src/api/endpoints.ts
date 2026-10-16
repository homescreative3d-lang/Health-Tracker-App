import { request, send } from "./client";
import type {
  AuditEntry,
  RefillEntry,
  StockPlan,
  CareTeamMember,
  AuthResult,
  Dose,
  Family,
  FamilyUser,
  HistoryRow,
  MedicalRecord,
  MedicalRecordInput,
  Medicine,
  MedicineInput,
  Notification,
  NotificationSettingsData,
  Patient,
  PatientInput,
  PrescriptionDraft,
  PushTestResult,
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
  register: (b: { email: string; password: string; displayName: string; phone?: string }) =>
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
  updateProfile: (b: { displayName: string; profileImageUrl: string; phone?: string }) =>
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

  /** Lets (or stops) a linked patient marking their own doses. */
  setPatientPortal: (id: string, canMarkOwnDoses: boolean) =>
    request<{ id: string; canMarkOwnDoses: boolean }>(
      `/patient/${id}/portal`,
      send("PUT", { canMarkOwnDoses }),
    ),
  /** Everyone caring for a patient, with contact details. */
  careTeam: (id: string) => request<CareTeamMember[]>(`/patient/${id}/care-team`),

  // ---- Feature flags ----
  /** Effective feature flags for the signed-in user. */
  getFeatures: () =>
    request<{ features: Record<string, boolean>; isSystemAdmin: boolean }>("/features"),
  /** All flags with overrides (system admins). */
  adminFeatures: () =>
    request<
      {
        key: string;
        description: string;
        enabled: boolean;
        overrides: { userId: string; email: string; enabled: boolean }[];
      }[]
    >("/admin/features"),
  /** Turns a feature on/off for everyone (system admins). */
  setFeature: (key: string, enabled: boolean) =>
    request<void>(`/admin/features/${key}`, send("PUT", { enabled })),
  /** Sets or clears (null) a per-user override (system admins). */
  setUserFeature: (key: string, userId: string, enabled: boolean | null) =>
    request<void>(`/admin/features/${key}/users/${userId}`, send("PUT", { enabled })),

  // ---- Medical history ----
  /** Whether prescription scanning is enabled and whether to show the data-sharing notice. */
  medicalAiStatus: () =>
    request<{
      enabled: boolean;
      showDataNotice: boolean;
      provider: string;
      limit: number;
      used: number;
      remaining: number;
      resetsAt: string | null;
    }>("/medical-records/ai-status"),
  /** Lists a patient's medical records, newest first. */
  getMedicalRecords: (patientId: string) =>
    request<MedicalRecord[]>(`/patients/${patientId}/medical-records`),
  /** Adds a record (optionally with its source document). */
  createMedicalRecord: (patientId: string, b: MedicalRecordInput) =>
    request<MedicalRecord>(`/patients/${patientId}/medical-records`, send("POST", b)),
  /** Updates a record. */
  updateMedicalRecord: (patientId: string, id: string, b: MedicalRecordInput) =>
    request<MedicalRecord>(`/patients/${patientId}/medical-records/${id}`, send("PUT", b)),
  /** Deletes a record and its source document. */
  deleteMedicalRecord: (patientId: string, id: string) =>
    request<void>(`/patients/${patientId}/medical-records/${id}`, send("DELETE")),
  /** Scans a prescription image/PDF and returns an editable draft (nothing is saved). */
  scanPrescription: (patientId: string, dataUrl: string) =>
    request<PrescriptionDraft>(
      `/patients/${patientId}/medical-records/extract`,
      send("POST", { dataUrl }),
    ),

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
  pauseMedicine: (id: string, startDate: string, endDate: string | undefined, reason: string) =>
    request<unknown>(
      `/medicine-actions/${id}/pause`,
      send("POST", { startDate, endDate: endDate || null, reason }),
    ),
  /** Changes a medicine's dose times from a date onwards (history is kept); returns the new record. */
  rescheduleMedicine: (id: string, effectiveDate: string, times: string[], reason: string) =>
    request<Medicine>(
      `/medicine-actions/${id}/reschedule`,
      send("POST", { effectiveDate, times, reason }),
    ),
  /** Full change history of a medicine across its rescheduled versions. */
  medicineHistory: (id: string) => request<AuditEntry[]>(`/medicines/${id}/history`),
  /** Adds stock (in the medicine's unit) and records it in the refill trail. */
  refillMedicine: (
    id: string,
    b: { quantity: number; date?: string; pharmacy?: string; note?: string },
  ) =>
    request<{
      id: string;
      stockQuantity: number;
      stockUnit: string;
      dosesLeft: number;
      entry: RefillEntry;
    }>(`/medicine-actions/${id}/refill`, send("POST", b)),
  /** Stock trail since the first fill (all versions of the medicine). */
  medicineRefills: (id: string) => request<RefillEntry[]>(`/medicines/${id}/refills`),
  /** Stock planner report for the next `days` days. */
  stockPlan: (patientId: string, days: number) =>
    request<StockPlan>(`/patients/${patientId}/stock-plan?days=${days}`),
  /** Ends an active pause as of today. */
  resumeMedicine: (id: string) => request<unknown>(`/medicine-actions/${id}/resume`, send("POST")),

  // ---- Doses ----
  /** Returns (and lazily materializes) the doses scheduled on a date. */
  getDoses: (date: string, patientId?: string) =>
    request<Dose[]>(`/doses?date=${date}` + (patientId ? `&patientId=${patientId}` : "")),
  /** Marks a dose taken (allowed from its scheduled time until the action window closes, 12 hours by default). */
  take: (id: string) => request<Dose>(`/doses/${id}/taken`, send("POST")),
  /** Marks a dose skipped with a reason (same window as take). */
  skip: (id: string, reason: string) =>
    request<Dose>(`/doses/${id}/skip`, send("POST", { reason })),
  /** Moves one dose to another date/time; returns the new (moved) dose. */
  rescheduleDose: (id: string, date: string, time: string, reason: string) =>
    request<Dose>(`/doses/${id}/reschedule`, send("POST", { date, time, reason })),
  /** Stores a future (virtual) dose so it can be acted on. */
  materializeDose: (medicineId: string, date: string, time: string) =>
    request<Dose>("/doses/materialize", send("POST", { medicineId, date, time })),
  /** Reverts a taken/skipped/rescheduled dose back to pending. */
  undo: (id: string) => request<Dose>(`/doses/${id}/undo`, send("POST")),

  // ---- History ----
  /** Queries dose history; `q` is a prebuilt query string beginning with `?`. */
  getHistory: (q: string) => request<HistoryRow[]>("/history" + q),
  /** Audit trail of changes (who, what, when, why) for accessible patients. */
  getChanges: (q: string) =>
    request<{ entry: AuditEntry; patientName: string }[]>("/history/changes" + q),

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
  /** Renames the family and/or sets its picture (data URL to upload, "" to remove, current URL to keep). */
  updateFamily: (name: string, photoUrl: string) =>
    request<{ id: string; name: string; photoUrl?: string | null }>(
      "/family",
      send("PUT", { name, photoUrl }),
    ),
  /** Removes a member (admin or members with the manage right). */
  removeFamilyMember: (userId: string) =>
    request<void>(`/family/members/${userId}`, send("DELETE")),
  /** Grants or revokes a member's manage right (admin only). */
  setFamilyPermissions: (userId: string, canManageMembers: boolean) =>
    request<unknown>(`/family/members/${userId}/permissions`, send("PUT", { canManageMembers })),
  /** Hands over the admin role (admin only). */
  makeFamilyAdmin: (userId: string) =>
    request<void>(`/family/members/${userId}/make-admin`, send("POST")),
  /** Withdraws a pending invitation. */
  cancelFamilyInvite: (id: string) => request<void>(`/family/invites/${id}`, send("DELETE")),
  /** Leaves the family (admins must hand over the role first unless they are the last member). */
  leaveFamily: () => request<void>("/family/leave", send("POST")),
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
