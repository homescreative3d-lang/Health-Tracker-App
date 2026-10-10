import type { ReactNode } from "react";
import { ChevronRight, User, Users } from "lucide-react";

type RoleScreenProps = {
  /** Called with who the plan is for. */
  onPick: (r: "self" | "caregiver") => void;
  /** Skips onboarding and goes straight to the hub. */
  onSkip: () => void;
};

/** Large tappable choice card. */
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
      <span className="role-copy">
        <b>{title}</b>
        <small>{text}</small>
      </span>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

/** First step for new accounts: is this plan for the user or for someone they care for? */
export function RoleScreen({ onPick, onSkip }: RoleScreenProps) {
  return (
    <section className="setup-card card">
      <span className="eyebrow">Step 1 of 2</span>
      <h2>Who are you setting this up for?</h2>
      <p className="muted lead">You can add more people later from your profile.</p>
      <div className="role-grid">
        <RoleCard
          icon={<Users aria-hidden="true" />}
          title="Someone I care for"
          text="A parent, partner, child or patient whose medicines you manage."
          accent="care"
          onClick={() => onPick("caregiver")}
        />
        <RoleCard
          icon={<User aria-hidden="true" />}
          title="Myself"
          text="Track your own medicines, reminders and daily doses."
          accent="self"
          onClick={() => onPick("self")}
        />
      </div>
      <button className="btn ghost full" onClick={onSkip}>
        Skip for now
      </button>
    </section>
  );
}
