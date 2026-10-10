/**
 * Browser file-reading helpers shared by every photo and attachment picker.
 * Previously the same FileReader + MIME-sniffing block was copy-pasted four times.
 */

/** Size limits enforced client-side (the API enforces the same limits). */
export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** MIME types accepted for profile and doctor photos. */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

/** MIME types accepted for patient attachments. */
export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** `accept` attribute for gallery/computer image pickers. */
export const IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp";

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Resolves a file's MIME type, falling back to its extension (iOS often reports HEIC files with an empty type).
 * @param file - The selected file.
 */
export function detectMime(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return file.type || EXTENSION_MIME[ext] || "";
}

/**
 * Reads a file into a base64 data URL.
 * @param file - The file to read.
 * @returns A promise of the data URL; rejects if the browser cannot read the file.
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this file. Please try another one."));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates and reads an image for upload as a data URL with a correct `data:image/...` prefix.
 * @param file - The selected image.
 * @param maxBytes - Maximum size allowed (defaults to 1 MB).
 * @throws Error with a user-facing message when type or size is invalid.
 */
export async function readImageFile(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<string> {
  const mime = detectMime(file) || "image/jpeg";
  if (!IMAGE_MIME_TYPES.includes(mime))
    throw new Error("Choose a JPEG, PNG, WebP or HEIC/HEIF image.");
  if (file.size > maxBytes) throw new Error("Photos must be 1 MB or smaller.");
  const data = await readAsDataUrl(file);
  return data.startsWith("data:image/") ? data : data.replace(/^data:[^;,]*/, "data:" + mime);
}

/**
 * Validates and reads a patient attachment (image, PDF or XLSX).
 * @param file - The selected file.
 * @returns Name, MIME type and data URL ready for the patient API.
 * @throws Error with a user-facing message when type or size is invalid.
 */
export async function readAttachmentFile(
  file: File,
): Promise<{ name: string; mimeType: string; dataUrl: string }> {
  const mime = detectMime(file);
  if (!ATTACHMENT_MIME_TYPES.includes(mime))
    throw new Error(`${file.name}: unsupported file type.`);
  if (file.size > MAX_ATTACHMENT_BYTES)
    throw new Error(`${file.name}: attachment must be 10 MB or smaller.`);
  return { name: file.name, mimeType: mime, dataUrl: await readAsDataUrl(file) };
}
