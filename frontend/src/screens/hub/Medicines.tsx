import { Pencil, Pill, Plus, Trash2 } from "lucide-react";
import { type Medicine } from "../../api";
import { fmtTime } from "../../lib/dates";
import { MedicineFormIcon } from "../../components/MedicineFormIcon";

export function Medicines({
  meds,
  onAdd,
  onEdit,
  onDelete,
}: {
  meds: Medicine[];
  onAdd: () => void;
  onEdit: (m: Medicine) => void;
  onDelete: (m: Medicine) => void;
}) {
  return (
    <div className="page-scroll">
      <div className="page-head">
        <div>
          <span className="eyebrow">YOUR MEDICINES</span>
          <h1>Medicine cabinet</h1>
          <p className="muted">
            {meds.length} active medicine{meds.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn accent" onClick={onAdd}>
            <Plus size={17} />
            Add medicine
          </button>
        </div>
      </div>
      {!meds.length ? (
        <div className="card empty-card">
          <div className="empty-icon">
            <Pill />
          </div>
          <b>Your medicine list is empty</b>
          <span className="muted">Add a medicine to create a schedule and refill reminder.</span>
          <button className="btn accent" onClick={onAdd}>
            <Plus size={17} />
            Add medicine
          </button>
        </div>
      ) : (
        <div className="medicine-grid">
          {meds.map((m) => (
            <div className="card med-card" key={m.id}>
              <div className="med-top">
                <div className="dose-icon">
                  <MedicineFormIcon form={m.form} size={22} />
                </div>
                <div className="med-info">
                  <b>{m.name}</b>
                  <span>
                    {m.strength || "Strength not specified"} · {m.form}
                  </span>
                  <span>{m.times.map(fmtTime).join(" · ")}</span>
                  <small
                    className={
                      m.supplyCount <= m.refillThreshold ? "status-danger" : "status-success"
                    }
                  >
                    {m.supplyCount} left
                    {m.supplyCount <= m.refillThreshold ? " · refill soon" : ""}
                  </small>
                </div>
              </div>
              <div className="med-meta">
                <span>
                  {m.frequencyPattern === "daily"
                    ? "Every day"
                    : m.frequencyPattern === "everyOtherDay"
                      ? "Every other day"
                      : m.frequencyPattern === "specificDays"
                        ? m.specificDays.join(", ")
                        : `Every ${m.cycleEvery} ${m.cycleUnit}`}
                </span>
                {m.withFood && <span>With food</span>}
              </div>
              <div className="med-actions">
                <button className="btn soft" onClick={() => onEdit(m)}>
                  <Pencil size={15} />
                  Edit
                </button>
                <button className="btn danger" onClick={() => onDelete(m)}>
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
