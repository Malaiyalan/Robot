import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, Camera, Download, ImageOff } from "lucide-react";
import { publicApi, resolveApiUrl } from "../lib/api";
import { formatBytes, formatDate, formatDateTime } from "../lib/format";
import type { PublicPhotoViewResponse } from "../types/api";

export function PublicPhotoViewPage() {
  const { photoId = "" } = useParams<{ photoId: string }>();
  const [photo, setPhoto] = useState<PublicPhotoViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setUnavailable(false);
    publicApi
      .getPhoto(photoId)
      .then((res) => {
        if (!mounted) return;
        setPhoto(res);
      })
      .catch(() => {
        if (!mounted) return;
        setUnavailable(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [photoId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-400/30 border-t-indigo-400" />
          <p className="text-sm text-slate-300">Loading photograph...</p>
        </div>
      </div>
    );
  }

  if (unavailable || !photo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300">
            <ImageOff className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">
            Sorry, this photograph is currently unavailable.
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            The photograph may have been removed or access has been disabled by the event organizer.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Enter Event Code
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/25 ring-1 ring-indigo-400/40">
              <Camera className="h-5 w-5 text-indigo-300" aria-hidden="true" />
            </span>
            <span className="font-bold">EventLens</span>
          </Link>
          <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-indigo-200">
            {photo.photo_id}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Event Photograph
              </p>
              <h1 className="mt-0.5 text-xl font-bold text-white sm:text-2xl">{photo.event_name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(photo.event_date)}
                </span>
                <span>Uploaded {formatDateTime(photo.uploaded_at)}</span>
                <span>{formatBytes(photo.file_size)}</span>
              </p>
            </div>

            {photo.download_enabled && (
              <a
                href={resolveApiUrl(photo.download_url)}
                download={`${photo.photo_id}.jpg`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Photograph
              </a>
            )}
          </div>

          <div className="flex items-center justify-center bg-black p-2 sm:p-6">
            <img
              src={resolveApiUrl(photo.image_url)}
              alt={`${photo.event_name} — ${photo.photo_id}`}
              onError={() => setUnavailable(true)}
              className="max-h-[75vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

