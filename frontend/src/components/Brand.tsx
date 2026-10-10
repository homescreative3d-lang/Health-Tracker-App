/** App wordmark + icon (four daypart compartments with a check — see `public/tended-icon.svg`). */
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
      <span className="brand-name">tended</span>
    </a>
  );
}
