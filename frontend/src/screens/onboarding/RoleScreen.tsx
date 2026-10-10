import type { ReactNode } from "react";
import { ChevronRight, User, Users } from "lucide-react";

export function RoleScreen({
  onPick,
  onSkip,
}: {
  onPick: (r: string) => void;
  onSkip: () => void;
}) {
  return (
    <section className="setup-card">
      <span className="eyebrow">WELCOME TO HEALTH COMPANION</span>
      <h2>Who are you setting this up for?</h2>
      <p className="muted lead">
        Choose the setup that fits. You can manage the plan from one place.
      </p>
      <div className="role-grid">
        <RoleCard
          icon={<Users />}
          title="I'm a caregiver"
          text="Manage medicines for a parent, patient or someone you look after."
          accent="orange"
          onClick={() => onPick("caregiver")}
        />
        <RoleCard
          icon={<User />}
          title="For myself"
          text="Track your own medicines, reminders and daily doses."
          accent="mint"
          onClick={() => onPick("self")}
        />
      </div>
      <button className="btn soft full" onClick={onSkip}>
        Skip for now — I’ll add a patient later
      </button>
    </section>
  );
}

function RoleCard({
  icon,
  title,
  text,
  accent,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button className="role-card" onClick={onClick}>
      <span className={"role-icon " + accent}>{icon}</span>
      <span>
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ChevronRight />
    </button>
  );
}
