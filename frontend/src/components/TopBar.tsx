import { useCallback, useRef, useState } from "react";
import { Bell, BookOpen, LogOut, User } from "lucide-react";
import { useCare } from "../hooks/CareAppContext";
import { useDismiss } from "../hooks/useDismiss";
import { Avatar } from "./Avatar";
import { Brand } from "./Brand";

/**
 * Sticky app bar: brand on the left; notifications, guide and account menu on the right.
 * On phones the guide button collapses to an icon so the bar never wraps.
 */
export function TopBar() {
  const app = useCare();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, closeMenu, menuOpen);
  const user = app.user;

  return (
    <header className="topbar">
      <Brand onClick={user ? () => app.setTab("today") : undefined} />
      {user && (
        <div className="top-actions">
          <button
            className="icon-btn notification-btn"
            aria-label={
              app.unreadCount ? `Notifications, ${app.unreadCount} unread` : "Notifications"
            }
            aria-expanded={app.notificationOpen}
            onClick={() => {
              setMenuOpen(false);
              app.setNotificationOpen(!app.notificationOpen);
            }}
          >
            <Bell size={20} aria-hidden="true" />
            {app.unreadCount > 0 && (
              <span className="notification-dot" aria-hidden="true">
                {app.unreadCount > 9 ? "9+" : app.unreadCount}
              </span>
            )}
          </button>
          <button
            className="help-btn"
            onClick={() => app.setGuide(true)}
            aria-label="How Tended works"
          >
            <BookOpen size={18} aria-hidden="true" />
            <span>How it works</span>
          </button>
          <div className="account-menu" ref={menuRef}>
            <button
              className="avatar-button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => {
                app.setNotificationOpen(false);
                setMenuOpen((v) => !v);
              }}
            >
              <Avatar name={user.displayName} src={user.profileImageUrl} size="sm" />
            </button>
            {menuOpen && (
              <div className="account-dropdown" role="menu" aria-label="Account">
                <div className="account-dropdown-head">
                  <b>{user.displayName}</b>
                  <small>{user.email}</small>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    app.setScreen("hub");
                    app.setTab("profile");
                  }}
                >
                  <User size={17} aria-hidden="true" />
                  <span>Profile</span>
                </button>
                <button
                  role="menuitem"
                  className="account-dropdown-signout"
                  onClick={() => {
                    setMenuOpen(false);
                    app.signOut();
                  }}
                >
                  <LogOut size={17} aria-hidden="true" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
