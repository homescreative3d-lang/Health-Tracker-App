import { BookOpen, HeartPulse } from "lucide-react";
import { Modal } from "../../components/Modal";

/** The four steps of the quick guide (a real sequence, so numbered). */
const STEPS = [
  {
    title: "Add the person you care for",
    text: "Or yourself. Add their conditions, doctor and documents.",
  },
  {
    title: "Add each medicine",
    text: "Enter strength, schedule and supply. Edit or pause it any time.",
  },
  {
    title: "Mark doses as they happen",
    text: "Take or Skip opens at the scheduled time and stays open for one hour.",
  },
  {
    title: "Share and plan ahead",
    text: "Invite family to help, check the calendar, and refill when reminded.",
  },
];

/** Short onboarding guide opened from the top bar, sidebar and profile. */
export function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="How Tended works"
      icon={<BookOpen size={20} />}
      onClose={onClose}
      className="guide-modal"
      actions={
        <button className="btn primary" onClick={onClose}>
          Got it
        </button>
      }
    >
      <ol className="guide-list">
        {STEPS.map((s, i) => (
          <li className="guide-step" key={s.title}>
            <span aria-hidden="true">{i + 1}</span>
            <div>
              <b>{s.title}</b>
              <p className="muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="guide-note">
        <HeartPulse aria-hidden="true" />
        <span>
          Tended organizes medicines. It doesn't replace advice from a doctor or pharmacist.
        </span>
      </div>
    </Modal>
  );
}
