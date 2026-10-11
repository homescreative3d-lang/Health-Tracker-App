import { useEffect, useState } from "react";
import { PackagePlus, Receipt } from "lucide-react";
import { api, type Medicine, type RefillEntry } from "../../api";
import { today } from "../../lib/dates";
import { err } from "../../lib/errors";
import { formatQty, parseDose } from "../../lib/doseQuantity";
import { Field } from "../../components/Field";
import { InlineError } from "../../components/InlineError";
import { Modal } from "../../components/Modal";

/** Records a refill in the medicine's unit (tablets, ml…). */
export function RefillDialog({
  medicine,
  onClose,
  onRefill,
}: {
  medicine: Medicine;
  onClose: () => void;
  onRefill: (
    m: Medicine,
    b: { quantity: number; date?: string; pharmacy?: string; note?: string },
  ) => Promise<boolean>;
}) {
  const { perDose, unit } = parseDose(medicine.doseAmount, medicine.form);
  const [qty, setQty] = useState<number>(0);
  const [date, setDate] = useState(today());
  const [pharmacy, setPharmacy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const after = (medicine.stockQuantity || 0) + (qty || 0);

  /** Validates and saves. */
  const save = async () => {
    if (!(qty > 0)) return setError(`Enter how many ${unit}s you added.`);
    if (date > today()) return setError("The refill date can't be in the future.");
    setBusy(true);
    const ok = await onRefill(medicine, {
      quantity: qty,
      date,
      pharmacy: pharmacy.trim() || undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={`Refill ${medicine.name}`}
      icon={<PackagePlus size={20} />}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Add to stock"}
          </button>
        </>
      }
    >
      <div className="refill-now">
        <span>In stock now</span>
        <b>{formatQty(medicine.stockQuantity, unit)}</b>
      </div>
      <div className="form-grid">
        <Field label={`How many ${unit}s did you add?`}>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value))}
            autoFocus
          />
        </Field>
        <Field label="Refill date">
          <input
            className="input"
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Pharmacy" hint="optional">
          <input className="input" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} />
        </Field>
        <Field label="Note" hint="optional">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. new strip of 15"
          />
        </Field>
      </div>
      {qty > 0 && (
        <p className="refill-after">
          After refill: <b>{formatQty(after, unit)}</b> ≈ {Math.floor(after / perDose)} doses
        </p>
      )}
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}

/** Labels for refill trail entries. */
const KIND: Record<RefillEntry["kind"], string> = {
  initial: "First fill",
  opening: "Opening stock",
  refill: "Refill",
  adjustment: "Correction",
};

/** The full stock trail of a medicine since its first fill. */
export function RefillHistoryDialog({
  medicine,
  onClose,
}: {
  medicine: Medicine;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RefillEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .medicineRefills(medicine.id)
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => {
        setError(err(e));
        setRows([]);
      });
  }, [medicine.id]);
  return (
    <Modal
      title={`${medicine.name}: stock history`}
      icon={<Receipt size={20} />}
      onClose={onClose}
      className="history-modal"
    >
      {error && <InlineError>{error}</InlineError>}
      {rows === null ? (
        <div className="preview-loading" role="status">
          Loading…
        </div>
      ) : !rows.length ? (
        <p className="muted">No stock movements recorded yet.</p>
      ) : (
        <ol className="refill-trail">
          {[...rows].reverse().map((r, i) => (
            <li
              key={r.id}
              className={`refill-item kind-${r.kind}`}
              style={{ ["--i" as string]: i }}
            >
              <span className="refill-dot" aria-hidden="true" />
              <div>
                <div className="audit-head">
                  <span className="audit-tag">{KIND[r.kind]}</span>
                  <time>
                    {new Date(r.at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </time>
                </div>
                <b>
                  {r.quantity >= 0 ? "+" : "−"}
                  {formatQty(Math.abs(r.quantity), r.unit)} → {formatQty(r.stockAfter, r.unit)} in
                  stock
                </b>
                <small>
                  by {r.actorName}
                  {r.pharmacy ? ` · ${r.pharmacy}` : ""}
                </small>
                {r.note && <q>{r.note}</q>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
