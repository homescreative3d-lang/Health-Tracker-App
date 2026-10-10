/**
 * Original illustrations for the landing page, drawn in the Tended daypart palette.
 * Pure SVG: crisp at any size, tiny to download, and themable.
 */

const C = {
  ink: "#0F2A33",
  teal: "#0B7A6E",
  tealSoft: "#E0F2EE",
  morning: "#F2A93B",
  afternoon: "#2FA37A",
  evening: "#E8735A",
  night: "#5B6BE0",
  sky: "#EEF1FD",
  white: "#FFFFFF",
};

/** Small square illustrations for the feature grid. */
export function FeatureArt({ name }: { name: string }) {
  const common = { viewBox: "0 0 96 96", width: 72, height: 72, "aria-hidden": true } as const;
  switch (name) {
    case "schedule":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill={C.tealSoft} />
          {[C.morning, C.afternoon, C.evening, C.night].map((c, i) => (
            <rect
              key={c}
              x={20 + (i % 2) * 30}
              y={20 + Math.floor(i / 2) * 30}
              width="26"
              height="26"
              rx="8"
              fill={c}
              opacity={0.9}
            />
          ))}
          <circle cx="33" cy="33" r="5" fill={C.white} />
          <circle cx="63" cy="63" r="5" fill={C.white} />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill={C.sky} />
          <path d="M48 24c-10 0-17 8-17 18v10l-5 8h44l-5-8V42c0-10-7-18-17-18Z" fill={C.night} />
          <circle cx="48" cy="66" r="6" fill={C.night} />
          <circle className="art-pulse" cx="66" cy="28" r="8" fill={C.evening} />
        </svg>
      );
    case "refill":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill="#FDF3E1" />
          <rect x="32" y="22" width="32" height="10" rx="4" fill={C.ink} />
          <rect
            x="28"
            y="32"
            width="40"
            height="44"
            rx="10"
            fill={C.white}
            stroke={C.ink}
            strokeWidth="3"
          />
          <rect x="31" y="58" width="34" height="15" rx="6" fill={C.morning} />
          <path d="M38 48h20" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "family":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill={C.tealSoft} />
          <circle cx="36" cy="38" r="9" fill={C.teal} />
          <circle cx="62" cy="40" r="8" fill={C.evening} />
          <circle cx="49" cy="52" r="6" fill={C.morning} />
          <path d="M20 74c2-12 9-18 16-18s14 6 16 18Z" fill={C.teal} />
          <path d="M48 74c2-10 8-15 14-15s12 5 14 15Z" fill={C.evening} />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill={C.sky} />
          <path
            d="M22 32a6 6 0 0 1 6-6h14l6 7h20a6 6 0 0 1 6 6v25a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z"
            fill={C.night}
          />
          <rect x="30" y="42" width="36" height="5" rx="2.5" fill={C.white} opacity=".8" />
          <rect x="30" y="52" width="24" height="5" rx="2.5" fill={C.white} opacity=".8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="10" y="10" width="76" height="76" rx="20" fill="#E5F4EA" />
          <rect x="24" y="52" width="10" height="20" rx="4" fill={C.afternoon} />
          <rect x="40" y="40" width="10" height="32" rx="4" fill={C.teal} />
          <rect x="56" y="30" width="10" height="42" rx="4" fill={C.night} />
          <path
            d="M24 40 44 28l12 6 16-12"
            fill="none"
            stroke={C.evening}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

/** Larger scene for the audience tabs. */
export function AudienceArt({ id }: { id: string }) {
  const hue = id === "caregivers" ? C.evening : id === "patients" ? C.teal : C.night;
  return (
    <svg viewBox="0 0 320 240" className="audience-art" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#FFF6E6" />
          <stop offset="1" stopColor={C.sky} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="320" height="240" rx="28" fill={`url(#sky-${id})`} />
      <circle cx="262" cy="56" r="22" fill={C.morning} opacity=".85" />
      <rect x="28" y="168" width="264" height="10" rx="5" fill={C.ink} opacity=".08" />
      {/* person(s) */}
      {id !== "patients" && (
        <g>
          <circle cx="104" cy="96" r="22" fill={C.ink} />
          <path d="M68 170c4-34 18-50 36-50s32 16 36 50Z" fill={hue} />
        </g>
      )}
      <g transform={id === "patients" ? "translate(-20 0)" : ""}>
        <circle cx="178" cy="104" r="20" fill="#7A4E3A" />
        <path
          d="M146 170c4-30 16-44 32-44s28 14 32 44Z"
          fill={id === "patients" ? hue : C.afternoon}
        />
      </g>
      {id === "families" && (
        <g>
          <circle cx="244" cy="122" r="14" fill={C.ink} />
          <path d="M222 170c3-22 11-32 22-32s19 10 22 32Z" fill={C.morning} />
        </g>
      )}
      {/* floating phone card */}
      <g className="art-float">
        <rect x="214" y="70" width="78" height="56" rx="12" fill={C.white} stroke="#E1E7EE" />
        <rect x="224" y="82" width="12" height="12" rx="4" fill={C.afternoon} />
        <rect x="242" y="84" width="40" height="8" rx="4" fill="#E1E7EE" />
        <rect x="224" y="102" width="58" height="14" rx="7" fill={C.teal} />
      </g>
    </svg>
  );
}

/** Shield illustration for the privacy section. */
export function ShieldArt() {
  return (
    <svg viewBox="0 0 200 220" className="shield-art" aria-hidden="true">
      <path d="M100 12 176 40v56c0 52-32 90-76 112C56 186 24 148 24 96V40Z" fill={C.teal} />
      <path d="M100 30 160 52v44c0 42-25 73-60 92-35-19-60-50-60-92V52Z" fill="#0E8F81" />
      <path
        d="m68 108 22 22 44-48"
        fill="none"
        stroke={C.white}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shield-check"
      />
    </svg>
  );
}
