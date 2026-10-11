import { Activity, CalendarDays, Clock3, Home, PackageSearch, Pill, User } from "lucide-react";
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
  "stock",
  "activity",
] as const;

/** A hub view id. */
export type HubTab = (typeof HUB_TABS)[number];

/** Primary destinations shown in the sidebar (desktop), rail (tablet) and bottom bar (phone). */
export const NAV_ITEMS: { id: HubTab; label: string; icon: LucideIcon; mobile?: boolean }[] = [
  { id: "today", label: "Today", icon: Home, mobile: true },
  { id: "calendar", label: "Calendar", icon: CalendarDays, mobile: true },
  { id: "medicines", label: "Medicines", icon: Pill, mobile: true },
  { id: "stock", label: "Stock planner", icon: PackageSearch },
  { id: "history", label: "History", icon: Clock3, mobile: true },
  { id: "activity", label: "Activity log", icon: Activity },
  { id: "profile", label: "Profile", icon: User, mobile: true },
];

/** Secondary views highlight their parent destination in the navigation. */
const PARENT: Partial<Record<HubTab, HubTab>> = {
  profileDetails: "profile",
  patientDetails: "profile",
  patientDetailsEdit: "profile",
  family: "profile",
  notifications: "profile",
};
// On phones (5-tab bar), Stock planner lives under Medicines and Activity under Profile.

/**
 * Returns the primary destination that should appear active for a view.
 * @param tab - Current view.
 */
export const activeNav = (tab: HubTab): HubTab => PARENT[tab] || tab;
