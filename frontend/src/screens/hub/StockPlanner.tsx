import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, Download, PackageSearch } from "lucide-react";
import { api, type Patient, type StockPlan, type StockPlanRow } from "../../api";
import { dateLabel, fmtTime } from "../../lib/dates";
import { err } from "../../lib/errors";
import { formatQty } from "../../lib/doseQuantity";
import { InlineError } from "../../components/InlineError";
import { PageHeader } from "../../components/PageHeader";
import { EmptyArt } from "../../components/art/EmptyArt";

const DAY_CHOICES = [1, 2, 3, 7, 14, 30];
const STATUS: Record<StockPlanRow["status"], string> = {
  out: "Out of stock",
  critical: "Critical",
  low: "Low",
  ok: "OK",
};

/** "½ tablet × 2/day at 8:00 AM, 8:00 PM". */
const howTaken = (r: StockPlanRow) =>
  `${r.doseAmount || formatQty(r.perDose, r.unit)} × ${r.times.length}/day${r.times.length ? ` (${r.times.map(fmtTime).join(", ")})` : ""}`;

/** Medium date or "—". */
const shortDate = (v: string | null) =>
  v
    ? new Date(v).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "—";

/**
 * Builds and downloads the stock report as a PDF (landscape A4, branded header, full table,
 * disclaimer footer). Generated in the browser; nothing is uploaded.
 */
async function downloadPdf(plan: StockPlan, rows: StockPlanRow[], onlyShort: boolean) {
  // Loaded on demand so the PDF library doesn't slow down the app's first load.
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const ribbon = ["#F2A93B", "#2FA37A", "#E8735A", "#5B6BE0"];
  ribbon.forEach((c, i) => {
    doc.setFillColor(c);
    doc.rect(14 + ((w - 28) / 4) * i, 10, (w - 28) / 4, 1.6, "F");
  });
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor("#0F2A33");
  doc.text("tended", 14, 22);
  doc.setFontSize(13).text(`Medicine stock report: ${plan.patientName}`, 14, 30);
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor("#2C4650");
  doc.text(
    `Covering the next ${plan.days} day${plan.days === 1 ? "" : "s"} from ${shortDate(plan.today)}  ·  ${
      onlyShort ? "Medicines that run short" : "All active medicines"
    }  ·  Generated ${new Date(plan.generatedAt).toLocaleString()}`,
    14,
    36,
  );
  autoTable(doc, {
    startY: 41,
    head: [
      [
        "Medicine",
        "For",
        "Prescribed by",
        "How it's taken",
        "Per day",
        "In stock",
        "Lasts",
        "Last refill",
        `Need (${plan.days}d)`,
        "To buy",
        "Status",
      ],
    ],
    body: rows.map((r) => [
      `${r.name} ${r.strength}\n${r.form}${r.paused ? " · paused" : ""}`,
      r.condition || "—",
      r.prescribedBy || "—",
      howTaken(r),
      formatQty(r.quantityPerDay, r.unit),
      `${formatQty(r.stockQuantity, r.unit)}\n${r.dosesLeft} doses`,
      r.daysLeft == null
        ? "Beyond period"
        : `${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"}\nruns out ${shortDate(r.runOutDate)}`,
      shortDate(r.lastRefillAt),
      formatQty(r.quantityNeeded, r.unit),
      r.quantityToBuy > 0 ? formatQty(Math.ceil(r.quantityToBuy), r.unit) : "—",
      STATUS[r.status],
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: "#0F2A33",
      lineColor: "#E1E7EE",
      lineWidth: 0.1,
    },
    headStyles: { fillColor: "#0F2A33", textColor: "#FFFFFF", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#F6F8FB" },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 10) {
        const s = rows[d.row.index].status;
        d.cell.styles.textColor = s === "ok" ? "#23885F" : s === "low" ? "#8A5A0B" : "#B4403A";
        d.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor("#5A6F78");
    doc.text(
      "Quantities are estimates from the schedule, dose amount, pauses and course end. Check with your pharmacist before buying. Tended does not give medical advice.",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(`Page ${i} of ${pages}`, w - 14, doc.internal.pageSize.getHeight() - 8, {
      align: "right",
    });
  }
  const safe = plan.patientName.replace(/[^\w-]+/g, "-");
  doc.save(`Tended-stock-${safe}-${plan.today}.pdf`);
}

/**
 * Stock planner: choose a patient and a number of days to see which medicines will run short,
 * how much is needed and how much to buy — with a downloadable PDF report.
 */
export function StockPlanner({ patients, patient }: { patients: Patient[]; patient: Patient }) {
  const [patientId, setPatientId] = useState(patient.id || patients[0]?.id || "");
  const [days, setDays] = useState(7);
  const [custom, setCustom] = useState("");
  const [onlyShort, setOnlyShort] = useState(true);
  const [plan, setPlan] = useState<StockPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reload whenever the patient or period changes (stale responses are ignored).
  useEffect(() => {
    if (!patientId) return;
    let active = true;
    setLoading(true);
    setError("");
    api
      .stockPlan(patientId, days)
      .then((p) => active && setPlan(p))
      .catch((e) => active && setError(err(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [patientId, days]);

  const rows = useMemo(
    () => (plan?.rows || []).filter((r) => !onlyShort || r.insufficient),
    [plan, onlyShort],
  );
  const short = (plan?.rows || []).filter((r) => r.insufficient).length;
  const urgent = (plan?.rows || []).filter(
    (r) => r.status === "out" || r.status === "critical",
  ).length;

  return (
    <div className="page-scroll stock-planner">
      <PageHeader
        kicker="Stock planner"
        title="Will the medicines last?"
        description="Pick a patient and how many days ahead to check. Calculated from each medicine's schedule, dose amount, pauses and course end."
        actions={
          plan && rows.length > 0 ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => void downloadPdf(plan, rows, onlyShort)}
            >
              <Download size={16} aria-hidden="true" /> Download PDF
            </button>
          ) : undefined
        }
      />
      <section className="card planner-controls">
        <label className="field">
          <span className="field-label">Patient</span>
          <select
            className="input"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Unnamed patient"}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Days ahead</span>
          <div className="chips">
            {DAY_CHOICES.map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={days === d}
                className={days === d && !custom ? "chip selected" : "chip"}
                onClick={() => {
                  setCustom("");
                  setDays(d);
                }}
              >
                {d} day{d === 1 ? "" : "s"}
              </button>
            ))}
            <input
              className="input planner-custom"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              placeholder="Custom"
              aria-label="Custom number of days"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                const n = Number(e.target.value);
                if (n >= 1 && n <= 365) setDays(Math.floor(n));
              }}
            />
          </div>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={onlyShort}
            onChange={(e) => setOnlyShort(e.target.checked)}
          />
          Only medicines that won't last {days} day{days === 1 ? "" : "s"}
        </label>
      </section>

      {plan && (
        <div className="history-summary planner-summary">
          <div className="summary-chip s-missed">
            <b>{short}</b>
            <span>run short in {days}d</span>
          </div>
          <div className="summary-chip s-skipped">
            <b>{urgent}</b>
            <span>out or critical</span>
          </div>
          <div className="summary-chip s-taken">
            <b>{plan.rows.length - short}</b>
            <span>covered</span>
          </div>
          <div className="summary-chip s-rate">
            <b>{dateLabel(plan.today)}</b>
            <span>
              to{" "}
              {dateLabel(
                new Date(new Date(plan.today).getTime() + (days - 1) * 86400000)
                  .toISOString()
                  .slice(0, 10),
              )}
            </span>
          </div>
        </div>
      )}

      {error && <InlineError>{error}</InlineError>}
      <div className="card history-table-wrap" aria-busy={loading}>
        {loading && !plan ? (
          <div className="preview-loading" role="status">
            Calculating…
          </div>
        ) : rows.length === 0 ? (
          <div className="history-empty">
            <EmptyArt kind="pills" />
            <b>
              {onlyShort
                ? `Everything lasts ${days} day${days === 1 ? "" : "s"}`
                : "No active medicines"}
            </b>
            <span className="muted">
              {onlyShort
                ? "Untick the filter to see every medicine's stock."
                : "Add medicines to plan stock."}
            </span>
          </div>
        ) : (
          <div className="history-table-scroll">
            <table className="history-data-table planner-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>For / prescribed by</th>
                  <th>How it's taken</th>
                  <th>Per day</th>
                  <th>In stock</th>
                  <th>Lasts</th>
                  <th>Last refill</th>
                  <th>Need ({days}d)</th>
                  <th>To buy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.medicineId}
                    className={`planner-row s-${r.status}`}
                    style={{ ["--i" as string]: i }}
                  >
                    <td data-label="Medicine">
                      <b>{r.name}</b>
                      <small>
                        {r.strength} · {r.form}
                        {r.paused ? " · paused" : ""}
                      </small>
                      <span className={`stock-label s-${r.status}`}>{STATUS[r.status]}</span>
                    </td>
                    <td data-label="For">
                      {r.condition || "—"}
                      <small>
                        {r.prescribedBy ? `Dr/Rx: ${r.prescribedBy}` : "Prescriber not set"}
                      </small>
                    </td>
                    <td data-label="How taken">{howTaken(r)}</td>
                    <td data-label="Per day">{formatQty(r.quantityPerDay, r.unit)}</td>
                    <td data-label="In stock">
                      <b>{formatQty(r.stockQuantity, r.unit)}</b>
                      <small>{r.dosesLeft} doses</small>
                    </td>
                    <td data-label="Lasts">
                      {r.daysLeft == null ? (
                        "Beyond period"
                      ) : (
                        <>
                          <b>
                            {r.daysLeft} day{r.daysLeft === 1 ? "" : "s"}
                          </b>
                          <small>runs out {shortDate(r.runOutDate)}</small>
                        </>
                      )}
                    </td>
                    <td data-label="Last refill">{shortDate(r.lastRefillAt)}</td>
                    <td data-label={`Need (${days}d)`}>{formatQty(r.quantityNeeded, r.unit)}</td>
                    <td data-label="To buy">
                      {r.quantityToBuy > 0 ? (
                        <b className="to-buy">
                          <AlertTriangle size={13} aria-hidden="true" />{" "}
                          {formatQty(Math.ceil(r.quantityToBuy), r.unit)}
                        </b>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted planner-note">
        <CalendarRange size={14} aria-hidden="true" /> Estimates assume doses are taken as
        scheduled. Paused days and days after a course ends need no stock. Always confirm quantities
        with your pharmacist.
      </p>
      {!patients.length && <PackageSearch aria-hidden="true" />}
    </div>
  );
}
