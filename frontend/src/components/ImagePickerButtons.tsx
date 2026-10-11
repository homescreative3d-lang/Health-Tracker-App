import { useRef, useState } from "react";
import { Camera, FileImage, Trash2 } from "lucide-react";
import { CameraCapture } from "./CameraCapture";
import { useCare } from "../hooks/CareAppContext";
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
 * Camera opens the in-app camera (asks for permission, live preview, capture/retake) on phones
 * and computers, falling back to the device camera app if in-app capture isn't available.
 */
export function ImagePickerButtons({
  onPick,
  onError,
  onRemove,
  label = "photo",
}: ImagePickerButtonsProps) {
  const app = useCare();
  const [camera, setCamera] = useState(false);
  const deviceCamera = useRef<HTMLInputElement>(null);

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
      <button
        type="button"
        className="btn soft upload-btn"
        onClick={() => (app.can("in_app_camera") ? setCamera(true) : deviceCamera.current?.click())}
      >
        <Camera size={16} aria-hidden="true" />
        Camera
      </button>
      {/* Fallback: the device's own camera app when in-app capture isn't available. */}
      <input
        ref={deviceCamera}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        hidden
        aria-label={`Take ${label} with the device camera`}
        onChange={(e) => void handle(e.currentTarget)}
      />
      {camera && (
        <CameraCapture
          title={`Take ${label}`}
          onClose={() => setCamera(false)}
          onCapture={(dataUrl) => {
            setCamera(false);
            onPick(dataUrl);
          }}
          onFallback={() => {
            setCamera(false);
            deviceCamera.current?.click();
          }}
        />
      )}
      {onRemove && (
        <button type="button" className="btn ghost" onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
          Remove
        </button>
      )}
    </div>
  );
}
