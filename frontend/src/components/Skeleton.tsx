/**
 * Shimmering placeholder blocks shown while data loads, shaped like the content they
 * replace so the layout doesn't jump when it arrives.
 */
export function Skeleton({
  w = "100%",
  h = 14,
  r = 8,
}: {
  w?: string | number;
  h?: number;
  r?: number;
}) {
  return (
    <span
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

/** Placeholder for a list of dose or medicine rows. */
export function SkeletonList({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="card skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <Skeleton w={44} h={44} r={14} />
          <div className="skeleton-lines">
            <Skeleton w="45%" h={14} />
            <Skeleton w="70%" h={12} />
          </div>
          <Skeleton w={64} h={28} r={999} />
        </div>
      ))}
    </div>
  );
}
