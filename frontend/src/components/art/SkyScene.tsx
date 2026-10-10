import { ART, currentDayPart } from "./palette";

/**
 * Illustrated sky for the Today header. The sun (or moon at night) sits on an arc at a
 * position matching the real time of day, and the sky colors follow the daypart.
 */
export function SkyScene({ now = new Date() }: { now?: Date }) {
  const part = currentDayPart(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const isNight = part === "Night" || minutes < 330;
  // Position along a 0..1 arc: daytime 5:30–21:00 for the sun; night wraps for the moon.
  const t = isNight
    ? (minutes >= 1260 ? minutes - 1260 : minutes + 180) / 510 // 21:00 → 05:30
    : (minutes - 330) / (1260 - 330);
  const x = 30 + Math.min(1, Math.max(0, t)) * 260;
  const y = 112 - Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 82;
  const skies: Record<string, [string, string]> = {
    Morning: ["#FFE7BF", "#FFF7EA"],
    Afternoon: ["#CFEFE4", "#F1FBF7"],
    Evening: ["#FFD2C2", "#FDEFF0"],
    Night: ["#25306B", "#3B4AA0"],
  };
  const [top, bottom] = isNight ? skies.Night : skies[part];
  return (
    <svg
      className={`sky-scene sky-${isNight ? "night" : part.toLowerCase()}`}
      viewBox="0 0 320 140"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="320" height="140" rx="24" fill="url(#sky-grad)" />
      <path
        d="M30 112 Q160 -52 290 112"
        fill="none"
        stroke={isNight ? "#ffffff33" : "#0F2A3314"}
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      {isNight &&
        [
          [60, 30],
          [120, 18],
          [210, 26],
          [260, 48],
          [90, 62],
          [180, 52],
        ].map(([sx, sy], i) => (
          <circle
            key={i}
            className="sky-star"
            cx={sx}
            cy={sy}
            r={i % 2 ? 1.6 : 2.2}
            fill="#fff"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
      <g className="sky-body" transform={`translate(${x} ${y})`}>
        {isNight ? (
          <>
            <circle r="15" fill="#F4F1FF" />
            <circle r="13" cx="6" cy="-4" fill="#3B4AA0" />
          </>
        ) : (
          <>
            <circle
              className="sky-halo"
              r="24"
              fill={part === "Evening" ? ART.evening : ART.morning}
              opacity=".22"
            />
            <circle r="14" fill={part === "Evening" ? ART.evening : ART.morning} />
          </>
        )}
      </g>
      {/* rolling hills in the four daypart colors */}
      <path
        d="M0 118 Q60 96 120 116 T240 112 T320 108 V140 H0Z"
        fill={ART.afternoon}
        opacity={isNight ? 0.5 : 0.85}
      />
      <path
        d="M0 128 Q80 112 160 126 T320 122 V140 H0Z"
        fill={ART.teal}
        opacity={isNight ? 0.65 : 1}
      />
    </svg>
  );
}
