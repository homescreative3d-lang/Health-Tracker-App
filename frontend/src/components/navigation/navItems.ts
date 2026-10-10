import { CalendarDays, Clock3, Home, Pill, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Every routable hub view. Secondary views live under Profile. */
export const HUB_TABS = [
  "today",
  "calendar",
  "medicines",
  "history",
  "profile",
  "profileDetails",
  "patientDetails",
  "patientDetailsEdit",
  "family",
  "notifications",
] as const;

/** A hub view id. */
export type HubTab = (typeof HUB_TABS)[number];

/** Primary destinations shown in the sidebar (desktop), rail (tablet) and bottom bar (phone). */
export const NAV_ITEMS: { id: HubTab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: Home },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "medicines", label: "Medicines", icon: Pill },
  { id: "history", label: "History", icon: Clock3 },
  { id: "profile", label: "Profile", icon: User },
];

/** Secondary views highlight their parent destination in the navigation. */
const PARENT: Partial<Record<HubTab, HubTab>> = {
  profileDetails: "profile",
  patientDetails: "profile",
  patientDetailsEdit: "profile",
  family: "profile",
  notifications: "profile",
};

/**
 * Returns the primary destination that should appear active for a view.
 * @param tab - Current view.
 */
export const activeNav = (tab: HubTab): HubTab => PARENT[tab] || tab;
