import { ChevronDown } from "lucide-react";
import { type Patient } from "../api";

export function PatientContextBar({
  patient,
  patients,
  onSelect,
}: {
  patient: Patient;
  patients: Patient[];
  onSelect: (p: Patient) => Promise<void>;
}) {
  return (
    <div className="patient-context-bar">
      <span className="patient-context-avatar">
        {patient.profileImageUrl ? (
          <img src={patient.profileImageUrl} alt="" />
        ) : (
          (patient.name || "?")
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")
        )}
      </span>
      <div className="patient-context-copy">
        <small>YOU ARE VIEWING</small>
        <b>{patient.name || "Select a patient"}</b>
      </div>
      {patients.length > 1 && (
        <label className="patient-context-select">
          <span>Switch patient</span>
          <select
            aria-label="Switch patient"
            value={patient.id}
            onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value);
              if (p) void onSelect(p);
            }}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Unnamed patient"}
                {p.relationship === "self" ? " (Me)" : ""}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </label>
      )}
    </div>
  );
}
