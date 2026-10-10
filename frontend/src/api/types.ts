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
};
export type Family = {
  id: string;
  name: string;
  members: FamilyUser[];
  pending: {
    id: string;
    inviteeUserId: string;
    inviteeEmail?: string | null;
    inviteeDisplayName?: string | null;
    inviteeProfileImageUrl?: string | null;
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
