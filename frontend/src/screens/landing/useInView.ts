import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref and whether the element has entered the viewport (fires once).
 * Used for a few deliberate reveal moments, not for every section.
 * @param threshold - Fraction of the element that must be visible.
 */
export function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (!("IntersectionObserver" in window)) return setInView(true);
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setInView(true), {
      threshold,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}
