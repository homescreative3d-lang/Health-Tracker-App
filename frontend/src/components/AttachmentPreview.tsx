import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import readXlsxFile, { readSheetNames } from "read-excel-file";
import type { PatientAttachment } from "../api";
import { formatSize } from "../lib/text";
import { Modal } from "./Modal";

/** Kind of viewer to use for an attachment. */
const kindOf = (a: PatientAttachment) =>
  a.mimeType.startsWith("image/")
    ? "image"
    : a.mimeType === "application/pdf"
      ? "pdf"
      : a.mimeType.includes("spreadsheet")
        ? "sheet"
        : "other";

/** Source URL: the signed storage URL, or the not-yet-saved data URL. */
const srcOf = (a: PatientAttachment) => a.url || a.dataUrl || "";

/**
 * Converts a data URL to a Blob URL. Browsers block `data:` PDFs inside frames, and Blob URLs
 * are also cheaper for large files. Remote URLs are returned unchanged.
 */
function useViewableUrl(src: string): string {
  const [url, setUrl] = useState(src);
  useEffect(() => {
    if (!src.startsWith("data:")) return setUrl(src);
    let objectUrl = "";
    fetch(src)
      .then((r) => r.blob())
      .then((b) => {
        objectUrl = URL.createObjectURL(b);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(src));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  return url;
}

/** Spreadsheet viewer: sheet tabs and the first 200 rows as a table. */
function SheetView({ src }: { src: string }) {
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState(0);
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setRows(null);
    setError("");
    fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then(async (blob) => {
        const names = await readSheetNames(blob);
        const data = await readXlsxFile(blob, { sheet: sheet + 1 });
        if (!active) return;
        setSheets(names);
        setRows(data.slice(0, 200) as unknown[][]);
      })
      .catch(
        () =>
          active && setError("This spreadsheet can't be previewed here. Use Download to open it."),
      );
    return () => {
      active = false;
    };
  }, [src, sheet]);

  if (error) return <div className="preview-fallback">{error}</div>;
  if (!rows)
    return (
      <div className="preview-loading" role="status">
        Opening spreadsheet…
      </div>
    );
  return (
    <div className="sheet-view">
      {sheets.length > 1 && (
        <div className="sheet-tabs" role="tablist">
          {sheets.map((n, i) => (
            <button
              type="button"
              key={n}
              role="tab"
              aria-selected={i === sheet}
              className={i === sheet ? "active" : ""}
              onClick={() => setSheet(i)}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <div className="sheet-scroll">
        <table>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i === 0 ? "head" : ""}>
                <th scope="row">{i + 1}</th>
                {r.map((c, j) => (
                  <td key={j}>
                    {c instanceof Date ? c.toLocaleDateString() : c == null ? "" : String(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 200 && <small className="muted">Showing the first 200 rows.</small>}
    </div>
  );
}

type AttachmentPreviewProps = {
  attachments: PatientAttachment[];
  /** Index to open first. */
  start: number;
  onClose: () => void;
};

/**
 * In-app attachment viewer: images (zoom/pan), PDFs (inline) and Excel sheets (table), with
 * previous/next navigation (arrow keys too) and a download button. Unsupported or unreachable
 * files fall back to download.
 */
export function AttachmentPreview({ attachments, start, onClose }: AttachmentPreviewProps) {
  const [index, setIndex] = useState(start);
  const [zoom, setZoom] = useState(false);
  const a = attachments[index];
  const src = srcOf(a);
  const url = useViewableUrl(src);
  const kind = kindOf(a);

  /** Moves to another attachment, wrapping around. */
  const go = useCallback(
    (n: number) => {
      setZoom(false);
      setIndex((n + attachments.length) % attachments.length);
    },
    [attachments.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (attachments.length < 2) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, index, attachments.length]);

  return (
    <Modal
      title={a.name}
      kicker={`${index + 1} of ${attachments.length}${a.size ? ` · ${formatSize(a.size)}` : ""}`}
      icon={kind === "sheet" ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
      onClose={onClose}
      className="preview-modal"
      actions={
        <>
          {attachments.length > 1 && (
            <div className="preview-nav">
              <button
                type="button"
                className="icon-btn"
                onClick={() => go(index - 1)}
                aria-label="Previous attachment"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => go(index + 1)}
                aria-label="Next attachment"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
          {kind === "image" && (
            <button type="button" className="btn soft" onClick={() => setZoom((z) => !z)}>
              {zoom ? (
                <ZoomOut size={16} aria-hidden="true" />
              ) : (
                <ZoomIn size={16} aria-hidden="true" />
              )}
              {zoom ? "Fit" : "Zoom"}
            </button>
          )}
          <a className="btn primary" href={url} download={a.name} target="_blank" rel="noreferrer">
            <Download size={16} aria-hidden="true" /> Download
          </a>
        </>
      }
    >
      <div className={`preview-stage kind-${kind}`} key={index}>
        {kind === "image" && (
          <div
            className={zoom ? "image-stage zoomed" : "image-stage"}
            onClick={() => setZoom((z) => !z)}
          >
            <img src={url} alt={a.name} />
          </div>
        )}
        {kind === "pdf" && <iframe title={a.name} src={url} className="pdf-frame" />}
        {kind === "sheet" && <SheetView src={url} />}
        {kind === "other" && (
          <div className="preview-fallback">
            This file type can't be previewed. Use Download to open it.
          </div>
        )}
      </div>
    </Modal>
  );
}
