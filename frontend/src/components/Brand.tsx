/** App wordmark + icon. The icon is the recolored `tended-icon.svg`. */
export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <a
      className="brand"
      href="#/today"
      onClick={(e) => {
        if (!onClick) return;
        e.preventDefault();
        onClick();
      }}
      aria-label="Tended home"
    >
      <img className="brand-mark" src="/tended-icon.svg" alt="" width={34} height={34} />
      <span className="brand-name">Tended</span>
    </a>
  );
}
