import type { ReactNode } from "react";
import { NAV_ITEMS, activeNav, type HubTab } from "./navItems";

type AppNavProps = {
  /** Current view. */
  tab: HubTab;
  /** Navigates to a destination. */
  onNavigate: (tab: HubTab) => void;
  /** "side" = sidebar/rail on tablet+desktop; "bottom" = phone tab bar. */
  variant: "side" | "bottom";
  /** Extra content under the sidebar links (e.g. guide link). */
  footer?: ReactNode;
};

/**
 * Single source of truth for primary navigation. The same items render as a labeled
 * sidebar (≥1024px), an icon rail (640–1023px) or a bottom tab bar (<640px); CSS decides
 * which variant is visible so positions never drift between screens.
 */
export function AppNav({ tab, onNavigate, variant, footer }: AppNavProps) {
  const current = activeNav(tab);
  return (
    <nav
      className={variant === "side" ? "side-nav" : "mobile-tabs"}
      aria-label={variant === "side" ? "Main" : "Main (bottom)"}
    >
      <ul>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              className={current === id ? "nav-item active" : "nav-item"}
              aria-current={current === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
            >
              <Icon size={variant === "side" ? 20 : 22} aria-hidden="true" />
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ul>
      {footer}
    </nav>
  );
}
