import { Check, HeartPulse, X } from "lucide-react";
import { today } from "../../lib/dates";
import { conditions } from "../../constants/options";

export function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal guide-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">QUICK GUIDE</span>
            <h2>How to use TENDED</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="guide-list">
          <GuideStep
            n="1"
            title="Add your care details"
            text="Tell TENDED who the plan is for and add relevant conditions."
          />
          <GuideStep
            n="2"
            title="Add each medicine"
            text="Enter the strength, form, schedule and supply count. You can edit it anytime."
          />
          <GuideStep
            n="3"
            title="Follow today's schedule"
            text="Use Take after you take a dose, or Skip when you intentionally miss one."
          />
          <GuideStep
            n="4"
            title="Check the calendar"
            text="Look ahead at upcoming doses and use refill reminders to stay prepared."
          />
        </div>
        <div className="guide-note">
          <HeartPulse />
          <span>
            TENDED helps organize your medication routine. It does not replace advice from your
            doctor or pharmacist.
          </span>
        </div>
        <button className="btn primary full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

function GuideStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="guide-step">
      <span>{n}</span>
      <div>
        <b>{title}</b>
        <p className="muted">{text}</p>
      </div>
    </div>
  );
}
