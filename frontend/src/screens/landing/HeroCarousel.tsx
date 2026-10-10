import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { HeroSlide } from "./landingContent";
import { PhoneMock } from "./PhoneMock";

const AUTOPLAY_MS = 5500;

/** Renders custom media when configured, otherwise the animated product preview. */
function SlideVisual({ slide }: { slide: HeroSlide }) {
  if (slide.media?.type === "video")
    return (
      <video
        className="slide-media"
        src={slide.media.src}
        poster={slide.media.poster}
        muted
        loop
        playsInline
        autoPlay
        aria-label={slide.media.alt}
      />
    );
  if (slide.media?.type === "image")
    return <img className="slide-media" src={slide.media.src} alt={slide.media.alt} />;
  return <PhoneMock kind={slide.preview} />;
}

/**
 * Accessible hero carousel (WAI-ARIA carousel pattern).
 * Autoplays every 5.5s; pauses on hover, keyboard focus, hidden tab, the pause button, or
 * when the user prefers reduced motion. Supports swipe, arrow keys, prev/next and dots.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const startX = useRef<number | null>(null);

  /** Moves to a slide, wrapping at both ends. */
  const go = useCallback(
    (n: number) => setIndex((n + slides.length) % slides.length),
    [slides.length],
  );

  // Autoplay loop.
  useEffect(() => {
    if (paused || hovered || tabHidden) return;
    const t = window.setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, hovered, tabHidden, go]);

  // Stop autoplay while the tab is hidden.
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const slide = slides[index];
  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Tended product tour"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        startX.current = null;
      }}
    >
      <div className="carousel-stage">
        <div className="stage-glow" aria-hidden="true" />
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={i === index ? "carousel-slide active" : "carousel-slide"}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${s.label}`}
            aria-hidden={i !== index}
          >
            <SlideVisual slide={s} />
          </div>
        ))}
      </div>
      <div className="carousel-caption" aria-live={paused ? "polite" : "off"}>
        <span className="carousel-label">{slide.label}</span>
        <h3 key={slide.id}>{slide.title}</h3>
        <p key={slide.id + "t"}>{slide.text}</p>
      </div>
      <div className="carousel-controls">
        <button className="carousel-btn" onClick={() => go(index - 1)} aria-label="Previous slide">
          <ChevronLeft size={18} />
        </button>
        <div className="carousel-dots" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === index}
              aria-label={s.label}
              className={i === index ? "carousel-dot active" : "carousel-dot"}
              onClick={() => go(i)}
            >
              {i === index && !paused && !hovered && (
                <span className="dot-progress" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
              )}
            </button>
          ))}
        </div>
        <button className="carousel-btn" onClick={() => go(index + 1)} aria-label="Next slide">
          <ChevronRight size={18} />
        </button>
        <button
          className="carousel-btn"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play slideshow" : "Pause slideshow"}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </section>
  );
}
