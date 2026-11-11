import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, X } from "lucide-react";
import { resolveApiUrl } from "../lib/api";

interface QrModalProps {
  open: boolean;
  photoId: string;
  eventName: string;
  qrImageUrl: string;
  targetUrl: string;
  onClose: () => void;
}

export function QrModal({ open, photoId, eventName, qrImageUrl, targetUrl, onClose }: QrModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    // Fallback light dismiss when closedBy="any" is unsupported
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const fullQrUrl = resolveApiUrl(qrImageUrl);
  const downloadQrUrl = fullQrUrl.includes("?") ? `${fullQrUrl}&download=1` : `${fullQrUrl}?download=1`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{eventName}</p>
          <h2 id={titleId} className="mt-0.5 text-lg font-bold text-slate-900">
            QR Code · {photoId}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close QR modal"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <img
          src={fullQrUrl}
          alt={`QR code for ${photoId}`}
          className="h-56 w-56 rounded-xl bg-white p-2 shadow-sm"
        />
        <p className="mt-3 break-all text-center font-mono text-xs text-slate-600">{targetUrl}</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <a
          href={downloadQrUrl}
          download={`${photoId}-qr.png`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download QR
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? "Copied Link" : "Copy Photo URL"}
        </button>
      </div>

      <a
        href={`/photos/${encodeURIComponent(photoId)}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        Open Public Photo Page
      </a>
    </dialog>
  );
}

