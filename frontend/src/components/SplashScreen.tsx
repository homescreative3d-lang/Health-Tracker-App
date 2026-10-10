import { useEffect, useState } from "react";
import { LogoMark } from "./LogoMark";

const MESSAGES = ["Opening your care plan…", "Sorting today's doses…", "Checking reminders…"];

/**
 * Branded loading screen shown while a saved session is restored: the logo's four
 * compartments fill in turn, the check draws, and a day-ribbon progress bar runs below.
 */
export function SplashScreen() {
  const [msg, setMsg] = useState(0);
  // Rotate the status line on slow connections so the wait feels alive.
  useEffect(() => {
    const t = window.setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="splash" role="status" aria-live="polite">
      <LogoMark size={88} animated />
      <span className="splash-word">tended</span>
      <div className="splash-bar" aria-hidden="true">
        <span />
      </div>
      <p key={msg}>{MESSAGES[msg]}</p>
    </div>
  );
}
