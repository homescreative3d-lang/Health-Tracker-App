import { ArrowRight, BellRing, Lock, PlayCircle } from "lucide-react";
import { Brand } from "../../components/Brand";
import { AudienceTabs } from "./AudienceTabs";
import { Faq } from "./Faq";
import { HeroCarousel } from "./HeroCarousel";
import { FeatureArt, ShieldArt } from "./Illustrations";
import { LandingNav } from "./LandingNav";
import { TryItDemo } from "./TryItDemo";
import { facts, features, heroSlides, privacyPoints, steps } from "./landingContent";
import { useInView } from "./useInView";

type LandingScreenProps = {
  /** Opens the auth screen on the Log in tab. */
  onLogin: () => void;
  /** Opens the auth screen on the Sign up tab. */
  onSignup: () => void;
};

/** Smooth-scrolls to a landing section by id. */
const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/**
 * Public landing page shown to signed-out visitors: product tour carousel, facts, features,
 * a playable demo, how it works, audiences, reminders, privacy, FAQ and a final call to action.
 * Signed-in users skip straight to the app (the flow is unchanged).
 */
export function LandingScreen({ onLogin, onSignup }: LandingScreenProps) {
  const how = useInView<HTMLOListElement>(0.3);
  const reminders = useInView<HTMLDivElement>(0.3);

  return (
    <div className="landing">
      <LandingNav onLogin={onLogin} onSignup={onSignup} />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="hero">
          <div className="hero-ribbon" aria-hidden="true" />
          <div className="landing-wrap hero-grid">
            <div className="hero-copy">
              <span className="hero-pill">
                <span className="hero-pill-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                Medicine care for the whole family
              </span>
              <h1>Every dose, every part of the day.</h1>
              <p className="hero-lead">
                Tended turns a pile of prescriptions into a calm daily plan, with reminders before
                each dose, refill alerts before you run out, and one shared record for everyone who
                helps.
              </p>
              <div className="hero-ctas">
                <button className="btn primary lg" onClick={onSignup}>
                  Create your account
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button className="btn soft lg" onClick={() => scrollTo("try")}>
                  <PlayCircle size={18} aria-hidden="true" />
                  Try the demo
                </button>
              </div>
              <p className="hero-fine">
                Already using Tended?{" "}
                <button className="text-btn" onClick={onLogin}>
                  Log in
                </button>
              </p>
            </div>
            <HeroCarousel slides={heroSlides} />
          </div>
        </section>

        {/* ---------- Facts ---------- */}
        <section className="facts" aria-label="Tended at a glance">
          <div className="landing-wrap facts-grid">
            {facts.map((f) => (
              <div className="fact" key={f.label}>
                <b>{f.value}</b>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="landing-section" id="features" aria-labelledby="features-title">
          <div className="landing-wrap">
            <div className="section-intro">
              <span className="eyebrow">Features</span>
              <h2 id="features-title">Everything a medicine routine needs, nothing it doesn't</h2>
              <p>
                Built around how care actually happens: several people, several medicines, and a day
                with four parts.
              </p>
            </div>
            <div className="feature-grid">
              {features.map((f) => (
                <article className="feature-card" key={f.title}>
                  <FeatureArt name={f.art} />
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Try it ---------- */}
        <section className="landing-section try-section" id="try" aria-labelledby="try-title">
          <div className="landing-wrap">
            <div className="section-intro">
              <span className="eyebrow">Try it</span>
              <h2 id="try-title">Take today's doses, right here</h2>
              <p>
                Tap each compartment to mark a dose. This is exactly how the Today screen works,
                minus the reminders.
              </p>
            </div>
            <TryItDemo onSignup={onSignup} />
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="landing-section" id="how" aria-labelledby="how-title">
          <div className="landing-wrap">
            <div className="section-intro">
              <span className="eyebrow">How it works</span>
              <h2 id="how-title">Set up in four steps</h2>
            </div>
            <ol ref={how.ref} className={how.inView ? "steps in-view" : "steps"}>
              {steps.map((s, i) => (
                <li className="step" key={s.title} style={{ ["--i" as string]: i }}>
                  <span className="step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Audiences ---------- */}
        <section className="landing-section tinted" aria-labelledby="who-title">
          <div className="landing-wrap">
            <div className="section-intro">
              <span className="eyebrow">Who it's for</span>
              <h2 id="who-title">Made for the people doing the caring</h2>
            </div>
            <AudienceTabs />
          </div>
        </section>

        {/* ---------- Reminders ---------- */}
        <section className="landing-section" aria-labelledby="remind-title">
          <div className="landing-wrap split">
            <div className="split-copy">
              <span className="eyebrow">Reminders</span>
              <h2 id="remind-title">Reminders that respect your day</h2>
              <p>
                Pick how many minutes before a dose the first reminder arrives and how often it
                repeats. A final alert fires on time, and if a dose is still unmarked an hour later,
                you'll know it was missed.
              </p>
              <ul className="check-list">
                <li>Works on any phone or computer where you turn notifications on</li>
                <li>Take or Skip right from the notification</li>
                <li>Refill alerts at the threshold you choose</li>
              </ul>
            </div>
            <div
              ref={reminders.ref}
              className={reminders.inView ? "notify-stack in-view" : "notify-stack"}
              aria-hidden="true"
            >
              {[
                ["15 min before", "Metformin 500 mg is due at 8:00 PM", "amber"],
                ["On time", "Metformin 500 mg is due now", "teal"],
                ["Refill", "Amlodipine has 5 doses left", "coral"],
              ].map(([t, m, c], i) => (
                <div className={`notify-card c-${c}`} key={t} style={{ ["--i" as string]: i }}>
                  <span className="notify-icon">
                    <BellRing size={16} />
                  </span>
                  <span>
                    <b>{t}</b>
                    <small>{m}</small>
                  </span>
                  {i < 2 && <span className="notify-take">Take</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Privacy ---------- */}
        <section className="landing-section privacy" aria-labelledby="privacy-title">
          <div className="landing-wrap split reverse">
            <ShieldArt />
            <div className="split-copy">
              <span className="eyebrow light">Privacy</span>
              <h2 id="privacy-title">Health details deserve care too</h2>
              <div className="privacy-grid">
                {privacyPoints.map((p) => (
                  <div className="privacy-item" key={p.title}>
                    <Lock size={18} aria-hidden="true" />
                    <div>
                      <b>{p.title}</b>
                      <p>{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="landing-section" id="faq" aria-labelledby="faq-title">
          <div className="landing-wrap faq-wrap">
            <div className="section-intro left">
              <span className="eyebrow">FAQ</span>
              <h2 id="faq-title">Questions, answered</h2>
              <p>Anything else? Create an account and open “How it works” inside the app.</p>
            </div>
            <Faq />
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="cta-band">
          <div className="landing-wrap cta-inner">
            <h2>Start tonight's doses on the right foot.</h2>
            <p>Set up your first medicine in a couple of minutes.</p>
            <div className="hero-ctas centered">
              <button className="btn light lg" onClick={onSignup}>
                Create your account
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button className="btn outline-light lg" onClick={onLogin}>
                Log in
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap footer-grid">
          <div>
            <Brand />
            <p className="footer-note">
              Tended helps organize medicine routines. It doesn't provide medical advice, diagnosis
              or treatment. Always follow your doctor's or pharmacist's instructions.
            </p>
          </div>
          <nav aria-label="Footer">
            <button onClick={() => scrollTo("features")}>Features</button>
            <button onClick={() => scrollTo("try")}>Try it</button>
            <button onClick={() => scrollTo("faq")}>FAQ</button>
            <button onClick={onLogin}>Log in</button>
            <button onClick={onSignup}>Sign up</button>
          </nav>
        </div>
        <div className="landing-wrap footer-bottom">© {new Date().getFullYear()} Tended</div>
      </footer>
    </div>
  );
}
