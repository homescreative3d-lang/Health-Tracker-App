import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Small context line above the title (sentence case). */
  kicker?: ReactNode;
  /** Page title. */
  title: ReactNode;
  /** One-line description under the title. */
  description?: ReactNode;
  /** Right-aligned actions; they wrap below the title on phones. */
  actions?: ReactNode;
};

/** Consistent page heading used by every hub screen so titles and actions align across breakpoints. */
export function PageHeader({ kicker, title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}
