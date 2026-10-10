import { ART } from "./palette";

/** Which empty-state scene to draw. */
export type EmptyKind = "pills" | "calendar" | "history" | "people" | "bell" | "patient";

/**
 * Small original illustrations for empty states, in the landing page's art style.
 * Decorative; the empty-state text carries the meaning.
 */
export function EmptyArt({ kind, size = 132 }: { kind: EmptyKind; size?: number }) {
  return (
    <svg
      className={`empty-art empty-${kind}`}
      viewBox="0 0 160 120"
      width={size}
      height={(size * 120) / 160}
      aria-hidden="true"
    >
      <ellipse cx="80" cy="108" rx="58" ry="8" fill={ART.ink} opacity=".06" />
      {kind === "pills" && (
        <g>
          <rect x="44" y="26" width="72" height="72" rx="20" fill={ART.ink} />
          {[ART.morning, ART.afternoon, ART.evening, ART.night].map((c, i) => (
            <rect
              key={c}
              x={52 + (i % 2) * 33}
              y={34 + Math.floor(i / 2) * 33}
              width="27"
              height="27"
              rx="8"
              fill={c}
              opacity={i === 0 ? 1 : 0.35}
            />
          ))}
          <g className="art-bob">
            <rect
              x="104"
              y="14"
              width="34"
              height="15"
              rx="7.5"
              fill={ART.white}
              stroke={ART.teal}
              strokeWidth="3"
              transform="rotate(-30 121 21)"
            />
            <path d="M121 13v16" stroke={ART.teal} strokeWidth="3" transform="rotate(-30 121 21)" />
          </g>
        </g>
      )}
      {kind === "calendar" && (
        <g>
          <rect
            x="38"
            y="24"
            width="84"
            height="76"
            rx="16"
            fill={ART.white}
            stroke="#E1E7EE"
            strokeWidth="2"
          />
          <rect x="38" y="24" width="84" height="22" rx="16" fill={ART.night} />
          <rect x="38" y="38" width="84" height="8" fill={ART.night} />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x={48 + (i % 4) * 17}
              y={56 + Math.floor(i / 4) * 18}
              width="11"
              height="11"
              rx="3"
              fill={i === 5 ? ART.morning : "#E1E7EE"}
            />
          ))}
          <circle className="art-bob" cx="124" cy="28" r="12" fill={ART.morning} />
        </g>
      )}
      {kind === "history" && (
        <g>
          <rect
            x="34"
            y="24"
            width="92"
            height="76"
            rx="16"
            fill={ART.white}
            stroke="#E1E7EE"
            strokeWidth="2"
          />
          {[ART.afternoon, ART.evening, ART.afternoon].map((c, i) => (
            <g key={i}>
              <circle cx="52" cy={44 + i * 20} r="6" fill={c} />
              <rect
                x="64"
                y={40 + i * 20}
                width={i === 1 ? 40 : 50}
                height="8"
                rx="4"
                fill="#E1E7EE"
              />
            </g>
          ))}
          <circle className="art-bob" cx="122" cy="26" r="14" fill={ART.teal} />
          <path d="M122 19v8l5 4" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}
      {kind === "people" && (
        <g>
          <circle cx="62" cy="50" r="13" fill={ART.ink} />
          <path d="M40 98c3-22 12-32 22-32s19 10 22 32Z" fill={ART.teal} />
          <circle cx="100" cy="56" r="11" fill="#7A4E3A" />
          <path d="M82 98c2-18 10-26 18-26s16 8 18 26Z" fill={ART.evening} />
          <g className="art-bob">
            <circle cx="122" cy="30" r="12" fill={ART.morning} />
            <path d="M122 24v12M116 30h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      )}
      {kind === "bell" && (
        <g>
          <circle cx="80" cy="60" r="40" fill={ART.sky} />
          <path
            className="art-ring"
            d="M80 32c-12 0-20 9-20 21v12l-6 9h52l-6-9V53c0-12-8-21-20-21Z"
            fill={ART.night}
          />
          <circle cx="80" cy="80" r="6" fill={ART.night} />
          <circle className="art-bob" cx="106" cy="36" r="8" fill={ART.evening} />
        </g>
      )}
      {kind === "patient" && (
        <g>
          <rect x="40" y="22" width="80" height="80" rx="22" fill={ART.tealSoft} />
          <circle cx="80" cy="54" r="15" fill={ART.teal} />
          <path d="M54 100c3-20 13-28 26-28s23 8 26 28Z" fill={ART.teal} />
          <g className="art-bob">
            <circle cx="118" cy="30" r="12" fill={ART.evening} />
            <path d="M118 24v12M112 30h12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      )}
    </svg>
  );
}
