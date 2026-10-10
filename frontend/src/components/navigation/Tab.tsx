import type { ReactNode } from "react";

export function Tab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? "tab active" : "tab"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
