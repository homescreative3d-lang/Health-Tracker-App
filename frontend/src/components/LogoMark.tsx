/**
 * Inline, animatable version of the Tended mark (four daypart compartments + a check).
 * `animated` plays the build-up sequence used by the splash screen.
 */
export function LogoMark({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      className={animated ? "logo-mark animated" : "logo-mark"}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <rect className="lm-bg" width="64" height="64" rx="16" fill="#0F2A33" />
      <rect className="lm-cell c1" x="10" y="10" width="20.5" height="20.5" rx="6" fill="#F2A93B" />
      <rect
        className="lm-cell c2"
        x="33.5"
        y="10"
        width="20.5"
        height="20.5"
        rx="6"
        fill="#2FA37A"
      />
      <rect
        className="lm-cell c4"
        x="10"
        y="33.5"
        width="20.5"
        height="20.5"
        rx="6"
        fill="#E8735A"
      />
      <rect
        className="lm-cell c3"
        x="33.5"
        y="33.5"
        width="20.5"
        height="20.5"
        rx="6"
        fill="#5B6BE0"
      />
      <path
        className="lm-check"
        d="M19 33.5 28.5 43 46 22"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
    </svg>
  );
}
