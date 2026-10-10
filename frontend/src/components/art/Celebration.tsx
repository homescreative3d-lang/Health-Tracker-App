import type React from "react";

/**
 * One-shot confetti burst in the four daypart colors. Rendered when something worth
 * celebrating happens (e.g. the day's last dose is taken); hidden under reduced motion.
 */
export function Celebration({ pieces = 18 }: { pieces?: number }) {
  return (
    <div className="celebration" aria-hidden="true">
      {Array.from({ length: pieces }, (_, i) => (
        <i key={i} style={{ "--i": i, "--n": pieces } as React.CSSProperties} />
      ))}
    </div>
  );
}
