import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  RefreshCw,
  RotateCcw,
  Share2,
  SwitchCamera,
  Upload,
} from "lucide-react";
import { publicApi, resolveApiUrl, tokenStore } from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";
import type {
  PublicEventInfo,
  PublicPhotoUploadResponse,
  PublicSessionPhotoItem,
} from "../types/api";

type CaptureStage = "initializing" | "live" | "preview" | "uploaded" | "camera-error";

export function CameraCapturePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEvent = (location.state as { event?: PublicEventInfo } | null)?.event || null;

  const [eventInfo, setEventInfo] = useState<PublicEventInfo | null>(initialEvent);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [stage, setStage] = useState<CaptureStage>("initializing");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<PublicPhotoUploadResponse | null>(null);
  const [sessionPhotos, setSessionPhotos] = useState<PublicSessionPhotoItem[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadLockRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(
    async (preferredDeviceId?: string, preferredFacing: "environment" | "user" = facingMode) => {
      stopCamera();
      setCameraError(null);
      setStage("initializing");

      if (!window.isSecureContext) {
        setCameraError(
          "Camera access requires a secure HTTPS context (or localhost). Please open this site over HTTPS."
        );
        setStage("camera-error");
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("This browser does not support camera access via MediaDevices API.");
        setStage("camera-error");
        return;
      }

      try {
        const videoConstraint: MediaTrackConstraints = preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { ideal: preferredFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } };

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraint,
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);

        setStage("live");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera permission denied or unavailable.";
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("notallowed")) {
          setCameraError(
            "Camera permission was denied. Please allow camera access in your browser settings and tap Retry Camera."
          );
        } else if (msg.toLowerCase().includes("notfound") || msg.toLowerCase().includes("device")) {
          setCameraError("No camera device was detected on this device.");
        } else {
          setCameraError(`Unable to access camera: ${msg}`);
        }
        setStage("camera-error");
      }
    },
    [facingMode, stopCamera]
  );

  // Verify active event session & load session photos
  useEffect(() => {
    const token = tokenStore.getEventSession();
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    let mounted = true;
    Promise.all([publicApi.getSession(), publicApi.getSessionPhotos()])
      .then(([sessionRes, photos]) => {
        if (!mounted) return;
        setEventInfo(sessionRes.event);
        setSessionPhotos(photos);
        setSessionChecking(false);
        void startCamera();
      })
      .catch(() => {
        if (!mounted) return;
        tokenStore.clearEventSession();
        navigate("/", { replace: true });
      });

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [navigate, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    };
  }, [capturedUrl]);

  const handleToggleFacing = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setSelectedDeviceId("");
    void startCamera(undefined, next);
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    void startCamera(deviceId || undefined, facingMode);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
        setUploadError(null);
        setUploadProgress(0);
        stopCamera();
        setStage("preview");
      },
      "image/jpeg",
      0.92
    );
  };

  const handleRetake = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadResult(null);
    void startCamera(selectedDeviceId || undefined, facingMode);
  };

  const handleUpload = async () => {
    if (!capturedBlob || uploadLockRef.current || isUploading) return;
    uploadLockRef.current = true;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const filename = `capture-${Date.now()}.jpg`;
      const result = await publicApi.uploadPhoto(capturedBlob, filename, (pct) => {
        setUploadProgress(pct);
      });
      setUploadResult(result);
      setStage("uploaded");
      const updatedList = await publicApi.getSessionPhotos().catch(() => null);
      if (updatedList) setSessionPhotos(updatedList);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      uploadLockRef.current = false;
    }
  };

  const handleShareQr = async (result: PublicPhotoUploadResponse) => {
    setShareNote(null);
    const shareUrl = `${window.location.origin}${result.photo_view_url}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${result.event_name} — ${result.photo_id}`,
          text: `View your event photograph (${result.photo_id})`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNote("Photo link copied to clipboard!");
      setTimeout(() => setShareNote(null), 2500);
    } catch {
      setShareNote("Use the link or Download QR button below.");
    }
  };

  const handleExitSession = () => {
    stopCamera();
    tokenStore.clearEventSession();
    navigate("/", { replace: true });
  };

  if (sessionChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-400/30 border-t-indigo-400" />
          <p className="text-sm text-slate-300">Validating event session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      {/* Top Bar: Event Name & Session Controls */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Event Photography Session
            </p>
            <h1 className="truncate text-lg font-bold text-white sm:text-xl">
              {eventInfo?.event_name || "Event Capture"}
            </h1>
            {eventInfo && (
              <p className="truncate text-xs text-slate-400">
                {formatDate(eventInfo.event_date)}
                {eventInfo.location ? ` · ${eventInfo.location}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-200 sm:inline-flex">
              {sessionPhotos.length} uploaded
            </span>
            <button
              type="button"
              onClick={handleExitSession}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
        {(stage === "initializing" || stage === "live") && (
          <section aria-label="Live camera preview" className="flex flex-1 flex-col gap-4">
            {/* Camera switcher bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleToggleFacing}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
              >
                <SwitchCamera className="h-4 w-4 text-indigo-300" aria-hidden="true" />
                Switch Camera ({facingMode === "environment" ? "Rear" : "Front"})
              </button>

              {devices.length > 1 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="camera-device-select" className="text-xs text-slate-300">
                    Camera:
                  </label>
                  <select
                    id="camera-device-select"
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Default ({facingMode})</option>
                    {devices.map((d, idx) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Live Video Viewfinder */}
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl min-h-[52vh]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full max-h-[65vh] w-full object-contain ${
                  facingMode === "user" && !selectedDeviceId ? "-scale-x-100" : ""
                }`}
              />
              {stage === "initializing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-400/30 border-t-indigo-400" />
                  <p className="text-sm text-slate-300">Starting camera...</p>
                </div>
              )}
            </div>

            {/* Capture Shutter Button */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <button
                type="button"
                disabled={stage !== "live"}
                onClick={handleCapture}
                aria-label="Capture Photograph"
                className="group flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/15 p-1.5 shadow-xl transition hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-slate-900 transition group-hover:bg-indigo-100">
                  <Camera className="h-7 w-7" aria-hidden="true" />
                </span>
              </button>
              <span className="text-xs font-medium text-slate-400">Tap to Capture Photograph</span>
            </div>
          </section>
        )}

        {stage === "camera-error" && (
          <section className="my-auto rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-white">Camera Unavailable</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-amber-100/90">
              {cameraError}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void startCamera(selectedDeviceId || undefined, facingMode)}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry Camera
              </button>
            </div>
          </section>
        )}

        {stage === "preview" && capturedUrl && (
          <section aria-label="Captured photograph preview" className="flex flex-1 flex-col gap-4">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl">
              <img
                src={capturedUrl}
                alt="Captured event photograph preview"
                className="mx-auto max-h-[62vh] w-full object-contain"
              />
            </div>

            {isUploading && (
              <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-4">
                <div className="flex items-center justify-between text-sm font-medium text-indigo-100">
                  <span>Uploading photograph to Cloudflare R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={handleRetake}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-base font-semibold text-white hover:bg-white/15 disabled:opacity-50"
              >
                <RotateCcw className="h-5 w-5" aria-hidden="true" />
                Retake
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleUpload}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
                {isUploading ? `Uploading (${uploadProgress}%)...` : "Upload Photograph"}
              </button>
            </div>
          </section>
        )}

        {stage === "uploaded" && uploadResult && (
          <section className="rounded-3xl border border-emerald-400/30 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
              <h2 className="mt-3 text-2xl font-bold text-white">Photograph Uploaded!</h2>
              <p className="mt-1 text-sm text-slate-300">
                Photo ID: <span className="font-mono font-semibold text-white">{uploadResult.photo_id}</span> ·{" "}
                {formatBytes(uploadResult.file_size)}
              </p>

              <div className="mt-6 rounded-3xl bg-white p-4 shadow-xl">
                <img
                  src={uploadResult.qr_data_url}
                  alt={`QR Code for ${uploadResult.photo_id}`}
                  className="h-56 w-56 object-contain"
                />
              </div>
              <p className="mt-3 text-xs text-indigo-200/80">
                Scan this QR code to view or download this photograph anytime.
              </p>
              {shareNote && <p className="mt-2 text-xs font-semibold text-emerald-300">{shareNote}</p>}

              <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                <a
                  href={`${resolveApiUrl(uploadResult.qr_image_url)}?download=1`}
                  download={`${uploadResult.photo_id}-qr.png`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download QR Code
                </a>
                <button
                  type="button"
                  onClick={() => void handleShareQr(uploadResult)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share QR Link
                </button>
                <Link
                  to={uploadResult.photo_view_url}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-white/10"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open Photo Page
                </Link>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Take Another Photo
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Session Photos History */}
        {sessionPhotos.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-slate-200">
              Captured in This Session ({sessionPhotos.length})
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sessionPhotos.map((item) => (
                <Link
                  key={item.photo_id}
                  to={`/photos/${encodeURIComponent(item.photo_id)}`}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-slate-900/70 p-2 transition hover:border-indigo-400/50"
                >
                  <img
                    src={resolveApiUrl(`${item.photo_view_url}/image`)}
                    alt={item.photo_id}
                    className="h-24 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                  <p className="mt-1.5 truncate font-mono text-xs font-semibold text-indigo-200 group-hover:text-white">
                    {item.photo_id}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

