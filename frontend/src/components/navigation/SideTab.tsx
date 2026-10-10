import type { ReactNode } from "react";

export function SideTab({
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
    <button className={active ? "side-tab active" : "side-tab"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
