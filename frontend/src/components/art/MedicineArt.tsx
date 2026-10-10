import { ART } from "./palette";

/** Tile color per medicine form, so cabinets are scannable at a glance. */
const TONES: Record<string, { bg: string; fg: string }> = {
  pill: { bg: "#FDF3E1", fg: ART.morning },
  injection: { bg: ART.tealSoft, fg: ART.teal },
  syrup: { bg: "#FDECE7", fg: ART.evening },
  drops: { bg: "#FDECE7", fg: ART.evening },
  inhaler: { bg: ART.sky, fg: ART.night },
  powder: { bg: "#EEF6EA", fg: ART.afternoon },
  other: { bg: "#F1F4F8", fg: "#5A6F78" },
};

/**
 * Illustrated tile for a medicine form (pill, injection, drops...). Larger and more
 * characterful than a line icon; used on medicine cards and the wizard.
 */
export function MedicineArt({ form, size = 56 }: { form: string; size?: number }) {
  const key = (form || "pill").toLowerCase();
  const tone = TONES[key] || TONES.other;
  return (
    <svg className="medicine-art" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect width="64" height="64" rx="18" fill={tone.bg} />
      {key === "pill" && (
        <g transform="rotate(-35 32 32)">
          <rect
            x="14"
            y="24"
            width="36"
            height="16"
            rx="8"
            fill="#fff"
            stroke={tone.fg}
            strokeWidth="3"
          />
          <rect x="15.5" y="25.5" width="16.5" height="13" rx="6.5" fill={tone.fg} />
        </g>
      )}
      {key === "injection" && (
        <g
          transform="rotate(-40 32 32)"
          fill="none"
          stroke={tone.fg}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="24" y="16" width="16" height="26" rx="3" fill="#fff" />
          <path d="M32 42v10M26 16h12M32 16V9M28 9h8M28 24h8M28 31h8" />
        </g>
      )}
      {(key === "drops" || key === "syrup") && (
        <g>
          <path
            d="M32 12c-7 10-13 17-13 25a13 13 0 0 0 26 0c0-8-6-15-13-25Z"
            fill="#fff"
            stroke={tone.fg}
            strokeWidth="3"
          />
          <path
            d="M25 39c0 4 3 6 6 7"
            stroke={tone.fg}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      )}
      {key === "inhaler" && (
        <g fill="#fff" stroke={tone.fg} strokeWidth="3" strokeLinejoin="round">
          <rect x="24" y="12" width="14" height="26" rx="4" />
          <path d="M20 38h22v12a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2Z" />
          <path d="M42 40h6v8h-6" />
        </g>
      )}
      {key === "powder" && (
        <g>
          <path
            d="M22 18h20v6H22zM19 24h26l3 26H16z"
            fill="#fff"
            stroke={tone.fg}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M23 38h18M26 44h12" stroke={tone.fg} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {!["pill", "injection", "drops", "syrup", "inhaler", "powder"].includes(key) && (
        <g>
          <rect
            x="20"
            y="14"
            width="24"
            height="36"
            rx="6"
            fill="#fff"
            stroke={tone.fg}
            strokeWidth="3"
          />
          <path d="M25 24h14M25 31h14" stroke={tone.fg} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
