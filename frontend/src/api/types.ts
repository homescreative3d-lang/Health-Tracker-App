/** Data contracts returned by the Tended API (mirrors backend `Contracts.cs`). */

export type User = {
  id: string;
  email: string;
  displayName: string;
  timeZoneId?: string;
  profileImageUrl?: string | null;
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
};
