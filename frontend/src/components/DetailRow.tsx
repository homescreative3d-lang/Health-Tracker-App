export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="muted">{label}</span>
      <b>{value}</b>
    </div>
  );
}
