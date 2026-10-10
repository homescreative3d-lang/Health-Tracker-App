import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "../../components/Brand";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#try", label: "Try it" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Sticky landing navbar with section links and Log in / Sign up. Gains a shadow after
 * scrolling; collapses into a slide-down menu on phones.
 */
export function LandingNav({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu with Escape.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  /** Smooth-scrolls to a section without changing the app's hash route. */
  const jump = (href: string) => {
    setMenu(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className={scrolled ? "landing-nav scrolled" : "landing-nav"}>
      <div className="landing-nav-inner">
        <Brand onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <nav className={menu ? "landing-links open" : "landing-links"} aria-label="Sections">
          {LINKS.map((l) => (
            <button key={l.href} onClick={() => jump(l.href)}>
              {l.label}
            </button>
          ))}
          <div className="landing-links-auth">
            <button className="btn soft full" onClick={onLogin}>
              Log in
            </button>
            <button className="btn primary full" onClick={onSignup}>
              Sign up
            </button>
          </div>
        </nav>
        <div className="landing-nav-actions">
          <button className="btn ghost" onClick={onLogin}>
            Log in
          </button>
          <button className="btn primary" onClick={onSignup}>
            Sign up
          </button>
        </div>
        <button
          className="icon-btn landing-menu-btn"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
