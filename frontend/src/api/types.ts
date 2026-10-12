/** Data contracts returned by the Tended API (mirrors backend `Contracts.cs`). */

export type User = {
  id: string;
  email: string;
  displayName: string;
  timeZoneId?: string;
  profileImageUrl?: string | null;
  /** Phone in E.164 format (+countrycode…), may be empty. */
  phone?: string;
  /** Signed in as a patient linked to a caregiver's patient record (read-only portal). */
  isLinkedPatient?: boolean;
  linkedPatientIds?: string[];
  /** The caregiver allows this linked patient to mark their own doses. */
  canMarkOwnDoses?: boolean;
};
export type PatientAttachment = {
  name: string;
  mimeType: string;
  key?: string;
  size?: number;
  url?: string;
  dataUrl?: string;
};
export type Patient = {
  id: string;
  name: string;
  dob: string | null;
  conditions: string[];
  notes: string;
  relationship?: string;
  mobile?: string;
  doctor?: string;
  medicalHistory?: string;
  doctorPhotoUrl?: string;
  profileImageUrl?: string;
  attachments?: PatientAttachment[];
  userId?: string;
  ownerName?: string;
  ownerEmail?: string;
  /** Optional email; a user signing in with it is linked as this patient (read-only). */
  email?: string;
  /** Linked patient may mark their own doses. */
  canMarkOwnDoses?: boolean;
  /** A user account is linked to this patient. */
  isLinked?: boolean;
  linkedUserName?: string | null;
  /** This record is the signed-in user's own (they are the linked patient). */
  isMyPatientProfile?: boolean;
  ownerPhone?: string;
};
export type FamilyUser = {
  id: string;
  userId?: string;
  email: string;
  displayName: string;
  status?: string;
  profileImageUrl?: string | null;
  /** Member role: one admin per family. */
  role?: "admin" | "member";
  /** Granted by the admin: may add/remove members and edit the family. */
  canManageMembers?: boolean;
  /** True for the signed-in user's own row. */
  isMe?: boolean;
  /** Search results: already in a family (can't be invited). */
  inFamily?: boolean;
  phone?: string;
};
export type Family = {
  id: string;
  name: string;
  /** Signed URL of the family picture. */
  photoUrl?: string | null;
  /** The signed-in user's role in this family. */
  myRole?: "admin" | "member";
  /** The signed-in user may add/remove members and edit the family. */
  canManage?: boolean;
  /** The signed-in user is the admin. */
  isAdmin?: boolean;
  members: FamilyUser[];
  pending: {
    id: string;
    inviteeUserId: string;
    inviteeEmail?: string | null;
    inviteeDisplayName?: string | null;
    inviteeProfileImageUrl?: string | null;
    invitedByName?: string | null;
    createdAt?: string;
    status: string;
  }[];
};
export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  dataJson: string;
  isRead: boolean;
  createdAt: string;
};
export type Medicine = {
  id: string;
  name: string;
  strength: string;
  form: string;
  condition: string;
  frequencyPattern: string;
  specificDays: string[];
  cycleEvery: number;
  cycleUnit: string;
  times: string[];
  liquid: string;
  withFood: boolean;
  startDate: string;
  durationType: string;
  durationValue: number;
  durationUnit: string;
  supplyCount: number;
  refillThreshold: number;
  isRecurring: boolean;
  pauseStartDate?: string | null;
  pauseEndDate?: string | null;
  /** Set when the schedule was rescheduled into a newer record; the medicine stops on this date. */
  endedOn?: string | null;
  /** The record this medicine replaced when its schedule was rescheduled. */
  rescheduledFromId?: string | null;
  /** Dose times before the reschedule (for "was 8:00 AM"). */
  previousTimes?: string[] | null;
  /** How much to take per dose, e.g. "½ tablet", "5 ml" (required for new medicines). */
  doseAmount?: string;
  /** Stock on hand in `stockUnit` (tablets, ml…). */
  stockQuantity?: number;
  stockUnit?: string;
  /** Quantity taken per dose (e.g. 0.5). */
  perDose?: number;
  /** Days until stock runs out (null = beyond the horizon/course). */
  daysLeft?: number | null;
  runOutDate?: string | null;
  /** out | critical | low | ok */
  stockStatus?: "out" | "critical" | "low" | "ok";
  prescribedBy?: string;
  lastRefillAt?: string | null;
};

/** One entry in a medicine's stock trail. */
export type RefillEntry = {
  id: string;
  kind: "initial" | "opening" | "refill" | "adjustment";
  quantity: number;
  unit: string;
  stockAfter: number;
  pharmacy: string;
  note: string;
  actorName: string;
  at: string;
};

/** One row of the stock planner report. */
export type StockPlanRow = {
  medicineId: string;
  name: string;
  strength: string;
  form: string;
  condition: string;
  prescribedBy: string;
  doseAmount: string;
  times: string[];
  frequency: string;
  perDose: number;
  unit: string;
  dosesPerDay: number;
  quantityPerDay: number;
  stockQuantity: number;
  dosesLeft: number;
  daysLeft: number | null;
  runOutDate: string | null;
  quantityNeeded: number;
  quantityToBuy: number;
  status: "out" | "critical" | "low" | "ok";
  insufficient: boolean;
  paused: boolean;
  courseEnds: string | null;
  lastRefillAt: string | null;
  refillThreshold: number;
};

/** Stock planner report. */
export type StockPlan = {
  patientId: string;
  patientName: string;
  doctor: string;
  days: number;
  today: string;
  generatedAt: string;
  rows: StockPlanRow[];
};
export type Dose = {
  id: string;
  medicineId: string;
  patientId: string;
  patientName: string;
  medName: string;
  strength: string;
  form: string;
  condition: string;
  time: string;
  liquid: string;
  withFood: boolean;
  status: string;
  takenAt?: string | null;
  skipReason?: string | null;
  rescheduleTo?: string | null;
  actionedByUserId?: string | null;
  actionedByName?: string | null;
  /** For a moved original: target time (`HH:mm`), paired with `rescheduleTo` (date). */
  rescheduleToTime?: string | null;
  /** For a moved-in dose: the original dose it replaces. */
  rescheduledFromId?: string | null;
  rescheduledFromDate?: string | null;
  rescheduledFromTime?: string | null;
  /** Calendar date of this dose (`YYYY-MM-DD`). */
  date?: string | null;
  /** Change history (audit) for this dose and the dose it was moved from. */
  history?: AuditEntry[] | null;
  /** How much to take, e.g. "½ tablet". */
  doseAmount?: string;
  /** Future dose computed on the fly (not stored until acted on). */
  isVirtual?: boolean;
};

/** One audit-trail entry: who did what, when and why. */
export type AuditEntry = {
  id: string;
  entityType: "dose" | "medicine";
  entityId: string;
  medicineId?: string | null;
  patientId?: string | null;
  action: string;
  actorName: string;
  reason: string;
  summary: string;
  at: string;
};
export type HistoryRow = {
  id: string;
  patientId: string;
  patientName: string;
  medicineId: string;
  medicineName: string;
  form: string;
  time: string;
  date: string;
  status: string;
  takenAt?: string | null;
  skipReason?: string | null;
  actionedByUserId?: string | null;
  actionedByName?: string | null;
};
/** Response returned by `/auth/login` and `/auth/register`. */
export type AuthResult = { user: User; token: string };

/** Per-user reminder settings returned by `/notifications/settings`. */
export type NotificationSettingsData = {
  timeZoneId: string;
  leadMinutes: number;
  repeatMinutes: number;
  finalNotificationEnabled: boolean;
  vapidPublicKey?: string | null;
  /** How dose reminders arrive: notification, alarm or both. */
  alertMode?: "notification" | "alarm" | "both";
  /** Server has both VAPID keys. */
  pushConfigured?: boolean;
  /** Devices this account has subscribed to push. */
  subscribedDevices?: number;
};

/** Result of a test push, with a reason when nothing was delivered. */
export type PushTestResult = {
  status: "sent" | "failed";
  reason?: "not_configured" | "no_subscription" | "keys_mismatch" | "expired" | "error" | null;
  message: string;
  subscriptions?: number;
  delivered?: number;
  detail?: string | null;
};

/** Medicine payload without the server-assigned id (used for create/update). */
export type MedicineInput = Omit<Medicine, "id">;

/** Patient payload accepted by create/update endpoints. */
export type PatientInput = {
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
  email?: string;
};

/** Kinds of medical history entries. */
export type MedicalRecordType =
  "diagnosis" | "prescription" | "procedure" | "allergy" | "lab" | "vaccination" | "note";

/** A prescribed item on a medical record. */
export type RecordMedicine = {
  name: string;
  strength?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};

/** A dated medical history entry. */
export type MedicalRecord = {
  id: string;
  patientId: string;
  /** `YYYY-MM-DD`, or null when unknown. */
  date: string | null;
  type: MedicalRecordType;
  title: string;
  details: string;
  doctor: string;
  facility: string;
  medicines: RecordMedicine[];
  /** Signed URL of the source document (e.g. the scanned prescription). */
  sourceUrl?: string | null;
  sourceMimeType?: string | null;
  /** Content came from a reviewed AI scan. */
  aiExtracted: boolean;
  createdAt: string;
};

/** Payload for creating/updating a record. */
export type MedicalRecordInput = {
  date: string;
  type: MedicalRecordType;
  title: string;
  details: string;
  doctor: string;
  facility: string;
  medicines: RecordMedicine[];
  sourceDataUrl?: string;
  removeSource?: boolean;
  aiExtracted?: boolean;
};

/** Draft read from a prescription by the AI scanner (never saved automatically). */
export type PrescriptionDraft = {
  date: string;
  doctor: string;
  facility: string;
  diagnosis: string;
  notes: string;
  medicines: RecordMedicine[];
  confidence: "high" | "medium" | "low";
  isPrescription: boolean;
};

/** A person on a patient's care team (owner + approved family). */
export type CareTeamMember = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  profileImageUrl?: string | null;
  isPrimary: boolean;
  familyRole?: "admin" | "member" | null;
  canManage: boolean;
};

/** Feature keys (all on by default). */
export type FeatureKey =
  | "medical_history"
  | "prescription_scan"
  | "family_sharing"
  | "rescheduling"
  | "change_history"
  | "push_notifications"
  | "patient_portal"
  | "attachments"
  | "in_app_camera"
  | "phone_calls";
