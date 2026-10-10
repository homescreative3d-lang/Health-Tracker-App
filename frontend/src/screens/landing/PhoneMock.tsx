import { Bell, Check, Pill, Syringe, Users } from "lucide-react";

/** Which product screen the mock phone shows. */
export type PreviewKind = "today" | "refill" | "family";

/** A miniature dose row used inside the mock screens. */
function MiniDose({
  name,
  meta,
  time,
  state,
  part,
}: {
  name: string;
  meta: string;
  time: string;
  state: "taken" | "due" | "upcoming";
  part: "morning" | "afternoon" | "evening" | "night";
}) {
  return (
    <div className={`mini-dose part-${part} is-${state}`}>
      <span className="mini-dose-icon">
        {name.includes("Insulin") ? <Syringe size={13} /> : <Pill size={13} />}
      </span>
      <span className="mini-dose-copy">
        <b>{name}</b>
        <small>{meta}</small>
      </span>
      <span className="mini-dose-side">
        <small>{time}</small>
        {state === "taken" && (
          <span className="mini-chip ok">
            <Check size={10} /> Taken
          </span>
        )}
        {state === "due" && <span className="mini-take">Take</span>}
        {state === "upcoming" && <span className="mini-chip">Later</span>}
      </span>
    </div>
  );
}

/**
 * Animated phone mockup that previews a real Tended screen. Decorative: the carousel
 * slide's text carries the meaning, so the device is hidden from assistive tech.
 */
export function PhoneMock({ kind }: { kind: PreviewKind }) {
  return (
    <div className={`phone phone-${kind}`} aria-hidden="true">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-status">
          <span>9:41</span>
          <span className="phone-brand">
            <img src="/tended-icon.svg" alt="" width={14} height={14} /> tended
          </span>
        </div>

        {kind === "today" && (
          <>
            <p className="phone-kicker">Good morning</p>
            <h4 className="phone-title">Amma's doses today</h4>
            <div className="phone-ring-row">
              <div className="phone-ring" style={{ ["--p" as string]: 66 }}>
                <span>66%</span>
              </div>
              <div className="phone-stats">
                <span>
                  <b>2</b> taken
                </span>
                <span>
                  <b>1</b> to go
                </span>
              </div>
            </div>
            <div className="phone-group part-morning">Morning</div>
            <MiniDose
              name="Metformin"
              meta="500 mg · with food"
              time="8:00"
              state="taken"
              part="morning"
            />
            <MiniDose name="Amlodipine" meta="5 mg" time="9:00" state="taken" part="morning" />
            <div className="phone-group part-afternoon">Afternoon</div>
            <MiniDose name="Vitamin D3" meta="1000 IU" time="1:00" state="due" part="afternoon" />
            <div className="phone-group part-night">Night</div>
            <MiniDose
              name="Insulin glargine"
              meta="10 units"
              time="9:30"
              state="upcoming"
              part="night"
            />
          </>
        )}

        {kind === "refill" && (
          <>
            <p className="phone-kicker">Notifications</p>
            <h4 className="phone-title">Right on time</h4>
            <div className="phone-notes">
              <div className="phone-note n1">
                <span className="dot amber" />
                <span>
                  <b>Medicine reminder</b>
                  <small>Metformin (500 mg) is due at 8:00 PM.</small>
                </span>
              </div>
              <div className="phone-note n2">
                <span className="dot coral" />
                <span>
                  <b>Refill reminder</b>
                  <small>Amlodipine has 5 doses left. Time to refill.</small>
                </span>
              </div>
              <div className="phone-note n3">
                <span className="dot teal" />
                <span>
                  <b>Medicine due now</b>
                  <small>Insulin glargine (10 units) for Amma is due now.</small>
                </span>
              </div>
            </div>
            <div className="phone-bell">
              <Bell size={18} />
            </div>
          </>
        )}

        {kind === "family" && (
          <>
            <p className="phone-kicker">Shared care</p>
            <h4 className="phone-title">Sharma family</h4>
            <div className="phone-members">
              {[
                ["PS", "Priya", "Owner", "#0B7A6E"],
                ["AS", "Arjun", "Approved", "#5B6BE0"],
                ["MI", "Meera", "Invited", "#E8735A"],
              ].map(([i, n, s, c]) => (
                <div className="phone-member" key={n}>
                  <span className="phone-avatar" style={{ background: c }}>
                    {i}
                  </span>
                  <b>{n}</b>
                  <small className={s === "Invited" ? "pending" : ""}>{s}</small>
                </div>
              ))}
            </div>
            <div className="phone-activity">
              <Users size={14} />
              <span>
                <b>Arjun</b> marked Metformin taken · 8:04 AM
              </span>
            </div>
            <div className="phone-activity a2">
              <Check size={14} />
              <span>
                <b>Priya</b> added Vitamin D3 · Yesterday
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
