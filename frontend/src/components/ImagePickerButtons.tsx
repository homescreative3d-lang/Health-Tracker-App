import { Camera, FileImage, Trash2 } from "lucide-react";
import { IMAGE_ACCEPT, readImageFile } from "../lib/files";
import { err } from "../lib/errors";

type ImagePickerButtonsProps = {
  /** Receives the validated image as a data URL. */
  onPick: (dataUrl: string) => void;
  /** Receives a user-facing error (wrong type, too large, unreadable). */
  onError: (message: string) => void;
  /** When provided, a Remove button is shown. */
  onRemove?: () => void;
  /** Accessible context, e.g. "patient photo". */
  label?: string;
};

/**
 * "Gallery" + "Camera" (+ optional "Remove") buttons for picking a photo.
 * On phones, Camera opens the rear camera; on desktop both open the file chooser.
 */
export function ImagePickerButtons({
  onPick,
  onError,
  onRemove,
  label = "photo",
}: ImagePickerButtonsProps) {
  /** Reads the chosen file, reports errors, and resets the input so the same file can be re-picked. */
  const handle = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      onPick(await readImageFile(file));
    } catch (e) {
      onError(err(e));
    }
  };
  return (
    <div className="photo-actions">
      <label className="btn soft upload-btn">
        <FileImage size={16} aria-hidden="true" />
        Gallery
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          aria-label={`Choose ${label} from gallery`}
          onChange={(e) => void handle(e.currentTarget)}
        />
      </label>
      <label className="btn soft upload-btn">
        <Camera size={16} aria-hidden="true" />
        Camera
        <input
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          hidden
          aria-label={`Take ${label} with camera`}
          onChange={(e) => void handle(e.currentTarget)}
        />
      </label>
      {onRemove && (
        <button type="button" className="btn ghost" onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
          Remove
        </button>
      )}
    </div>
  );
}
