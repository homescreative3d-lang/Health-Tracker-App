import { Check } from "lucide-react";
import { type Dose } from "../api";
import { fmtTime } from "../lib/dates";
import { MedicineFormIcon } from "./MedicineFormIcon";

export function DoseRow({
  d,
  onDose,
}: {
  d: Dose;
  onDose: (d: Dose, a: "taken" | "skip") => void;
}) {
  return (
    <div className="dose-row">
      <div
        className={
          d.status === "taken"
            ? "dose-icon taken"
            : d.status === "skipped"
              ? "dose-icon skipped"
              : "dose-icon"
        }
      >
        <MedicineFormIcon form={d.form} size={21} />
      </div>
      <div className="dose-main">
        <div className="dose-top">
          <div>
            <b>{d.medName}</b>
            <span className="muted">
              {d.strength}
              {d.withFood ? " · with food" : ""}
            </span>
          </div>
          <time>{fmtTime(d.time)}</time>
        </div>
        {d.status === "taken" ? (
          <small className="status-success">
            <Check size={14} />
            Taken
          </small>
        ) : d.status === "skipped" ? (
          <small className="status-danger">Skipped</small>
        ) : (
          <div className="dose-actions">
            <button onClick={() => onDose(d, "skip")}>Skip</button>
            <button className="take" onClick={() => onDose(d, "taken")}>
              <Check size={15} />
              Take
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
