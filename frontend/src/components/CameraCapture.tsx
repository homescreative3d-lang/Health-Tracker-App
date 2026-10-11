import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, RotateCcw, SwitchCamera } from "lucide-react";
import { Modal } from "./Modal";

type CameraCaptureProps = {
  /** Receives the captured photo as a JPEG data URL. */
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
  /** Opens the device's own camera/file picker when in-app capture isn't possible. */
  onFallback: () => void;
  /** Dialog title, e.g. "Photograph the prescription". */
  title?: string;
};

/** Longest edge of captured photos (keeps uploads small but legible for prescriptions). */
const MAX_EDGE = 1600;

/**
 * In-app camera: asks the browser for camera permission (getUserMedia), shows a live preview,
 * switches front/back cameras, and captures a photo with retake/use. If the camera is denied,
 * missing or the page isn't HTTPS, it explains why and offers the device camera instead.
 */
export function CameraCapture({
  onCapture,
  onClose,
  onFallback,
  title = "Take a photo",
}: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [state, setState] = useState<"asking" | "live" | "captured" | "error">("asking");
  const [error, setError] = useState("");
  const [shot, setShot] = useState("");
  const [cameras, setCameras] = useState(0);

  /** Stops every track so the camera light turns off. */
  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  /** Requests the camera (prompting for permission the first time) and starts the preview. */
  const start = useCallback(
    async (mode: "environment" | "user") => {
      stop();
      setState("asking");
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError("In-app camera needs a secure (HTTPS) page and a modern browser.");
        return setState("error");
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCameras(devices.filter((d) => d.kind === "videoinput").length);
        setState("live");
      } catch (e) {
        const name = (e as DOMException)?.name;
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera access was blocked. Allow the camera for this site in your browser's settings (the lock or camera icon in the address bar), then try again."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera was found on this device."
              : name === "NotReadableError"
                ? "The camera is being used by another app. Close it and try again."
                : "The camera couldn't be started.",
        );
        setState("error");
      }
    },
    [stop],
  );

  useEffect(() => {
    void start(facing);
    return stop;
  }, [facing, start, stop]);

  /** Captures the current frame, scaled down to MAX_EDGE, as JPEG. */
  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    // Step quality down until under ~900 KB (server limit for photos is 1 MB).
    let quality = 0.88;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length * 0.75 > 900_000 && quality > 0.4) {
      quality -= 0.12;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    setShot(data);
    setState("captured");
  };

  return (
    <Modal
      title={title}
      icon={<Camera size={20} />}
      onClose={() => {
        stop();
        onClose();
      }}
      className="camera-modal"
      actions={
        state === "captured" ? (
          <>
            <button type="button" className="btn soft" onClick={() => setState("live")}>
              <RotateCcw size={16} aria-hidden="true" /> Retake
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                stop();
                onCapture(shot);
              }}
            >
              Use photo
            </button>
          </>
        ) : state === "error" ? (
          <>
            <button type="button" className="btn soft" onClick={() => void start(facing)}>
              <RefreshCcw size={16} aria-hidden="true" /> Try again
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                stop();
                onFallback();
              }}
            >
              <Camera size={16} aria-hidden="true" /> Use device camera
            </button>
          </>
        ) : (
          <>
            {cameras > 1 && (
              <button
                type="button"
                className="btn soft"
                onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
              >
                <SwitchCamera size={16} aria-hidden="true" /> Switch
              </button>
            )}
            <button
              type="button"
              className="btn primary shutter"
              onClick={capture}
              disabled={state !== "live"}
            >
              <Camera size={18} aria-hidden="true" /> Capture
            </button>
          </>
        )
      }
    >
      <div className={`camera-stage is-${state}`}>
        <video
          ref={video}
          playsInline
          muted
          className={facing === "user" ? "mirror" : ""}
          hidden={state === "captured" || state === "error"}
        />
        {state === "captured" && <img src={shot} alt="Captured photo" />}
        {state === "asking" && (
          <div className="camera-message" role="status">
            <Camera size={28} aria-hidden="true" />
            <b>Allow camera access</b>
            <span>Your browser will ask for permission to use the camera.</span>
          </div>
        )}
        {state === "error" && (
          <div className="camera-message error" role="alert">
            <Camera size={28} aria-hidden="true" />
            <b>Camera unavailable</b>
            <span>{error}</span>
          </div>
        )}
        {state === "live" && <span className="camera-frame" aria-hidden="true" />}
      </div>
    </Modal>
  );
}
