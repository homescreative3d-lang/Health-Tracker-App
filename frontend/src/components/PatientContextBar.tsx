import { ChevronDown } from "lucide-react";
import type { Patient } from "../api";
import { Avatar } from "./Avatar";

type PatientContextBarProps = {
  /** Patient currently in focus. */
  patient: Patient;
  /** All accessible patients (switcher shown when more than one). */
  patients: Patient[];
  /** Switches the focused patient. */
  onSelect: (p: Patient) => Promise<void>;
};

/** Shows whose plan is being viewed, with a switcher when the user cares for several people. */
export function PatientContextBar({ patient, patients, onSelect }: PatientContextBarProps) {
  return (
    <div className="patient-context-bar">
      <Avatar name={patient.name} src={patient.profileImageUrl} size="sm" />
      <div className="patient-context-copy">
        <small>Viewing plan for</small>
        <b>{patient.name || "No patient selected"}</b>
      </div>
      {patients.length > 1 && (
        <label className="patient-context-select">
          <span className="sr-only">Switch patient</span>
          <select
            value={patient.id}
            onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value);
              if (p) void onSelect(p);
            }}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Unnamed patient"}
                {p.relationship === "self" ? " (me)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      )}
    </div>
  );
}
