/** Read-only label/value pair used in detail views. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}
