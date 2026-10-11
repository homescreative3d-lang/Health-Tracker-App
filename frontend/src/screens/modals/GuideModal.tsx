import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarClock,
  Download,
  Eye,
  History,
  Paperclip,
  Pause,
  Pill,
  Rocket,
  Search,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";
import guide from "../../content/guide.json";
import { Modal } from "../../components/Modal";

/** Icon per guide section (keys match `icon` in content/guide.json). */
const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  user: User,
  pill: Pill,
  sun: Sun,
  "calendar-clock": CalendarClock,
  pause: Pause,
  history: History,
  activity: Activity,
  paperclip: Paperclip,
  users: Users,
  eye: Eye,
  bell: Bell,
  settings: Settings,
};

/**
 * The full Tended guide: every flow as numbered steps, searchable, with a printable PDF
 * download. Content comes from `content/guide.json`, the same source used to build the PDF.
 */
export function GuideModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState(guide.sections[0].id);
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const sections = useMemo(
    () =>
      term
        ? guide.sections.filter(
            (s) =>
              s.title.toLowerCase().includes(term) ||
              s.steps.some((st) => st.toLowerCase().includes(term)),
          )
        : guide.sections,
    [term],
  );
  const current = sections.find((s) => s.id === active) || sections[0];
  const Icon = current ? ICONS[current.icon] || BookOpen : BookOpen;

  return (
    <Modal
      title={guide.title}
      icon={<BookOpen size={20} />}
      onClose={onClose}
      className="guide-modal"
      actions={
        <>
          <a className="btn soft" href="/tended-guide.pdf" download="Tended-guide.pdf">
            <Download size={16} aria-hidden="true" /> Download PDF
          </a>
          <button type="button" className="btn primary" onClick={onClose}>
            Got it
          </button>
        </>
      }
    >
      <p className="muted guide-intro">{guide.intro}</p>
      <div className="guide-layout">
        <nav className="guide-nav" aria-label="Guide sections">
          <label className="guide-search">
            <Search size={15} aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the guide"
              aria-label="Search the guide"
            />
          </label>
          {sections.map((s, i) => {
            const SIcon = ICONS[s.icon] || BookOpen;
            return (
              <button
                type="button"
                key={s.id}
                className={current?.id === s.id ? "guide-nav-item active" : "guide-nav-item"}
                onClick={() => setActive(s.id)}
                style={{ ["--i" as string]: i }}
              >
                <SIcon size={16} aria-hidden="true" />
                <span>{s.title}</span>
              </button>
            );
          })}
          {!sections.length && <p className="muted">Nothing matches “{q}”.</p>}
        </nav>
        {current && (
          <section className="guide-content" key={current.id} aria-live="polite">
            <h3>
              <span className="guide-content-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
              {current.title}
            </h3>
            <ol className="guide-steps">
              {current.steps.map((step, i) => (
                <li key={i} style={{ ["--i" as string]: i }}>
                  <span className="guide-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <p className="guide-disclaimer">{guide.disclaimer}</p>
    </Modal>
  );
}
