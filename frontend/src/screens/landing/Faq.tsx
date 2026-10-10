import { useState } from "react";
import { Plus } from "lucide-react";
import { faqs } from "./landingContent";

/** FAQ accordion: one answer open at a time, animated height, keyboard accessible. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div className={isOpen ? "faq-item open" : "faq-item"} key={f.q}>
            <h3>
              <button
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                id={`faq-q-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{f.q}</span>
                <Plus size={20} aria-hidden="true" className="faq-icon" />
              </button>
            </h3>
            <div
              className="faq-answer"
              id={`faq-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
            >
              <div>
                <p>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
