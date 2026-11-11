import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CopyButton } from "../components/CopyButton";
import { QrModal } from "../components/QrModal";
import { adminApi, resolveApiUrl } from "../lib/api";
import { formatBytes, formatDate, formatDateTime, formatTime, statusBadgeClasses } from "../lib/format";
import type { AdminPhoto, EventItem, EventStatus } from "../types/api";

export function AdminEventDetailPage() {
  const { eventUid = "" } = useParams<{ eventUid: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [photosTotalBytes, setPhotosTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [photoSearch, setPhotoSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location: "",
    organizer_name: "",
    organizer_contact: "",
    status: "active" as EventStatus,
    accepting_photos: true,
    enforce_time_window: false,
  });

  // Modals & action states
  const [retryingStorage, setRetryingStorage] = useState(false);
  const [qrPhoto, setQrPhoto] = useState<AdminPhoto | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<
    | { kind: "delete-event" }
    | { kind: "archive-event" }
    | { kind: "delete-photo"; photo: AdminPhoto }
    | null
  >(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ev = await adminApi.getEvent(eventUid);
      setEvent(ev);
      setEditForm({
        name: ev.name,
        description: ev.description || "",
        event_date: ev.event_date,
        start_time: ev.start_time ? ev.start_time.slice(0, 5) : "",
        end_time: ev.end_time ? ev.end_time.slice(0, 5) : "",
        location: ev.location || "",
        organizer_name: ev.organizer_name || "",
        organizer_contact: ev.organizer_contact || "",
        status: ev.status,
        accepting_photos: ev.accepting_photos,
        enforce_time_window: ev.enforce_time_window,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event.");
    } finally {
      setLoading(false);
    }
  }, [eventUid]);

  const loadPhotos = useCallback(async () => {
    setPhotosLoading(true);
    try {
      const res = await adminApi.listEventPhotos(eventUid, {
        search: photoSearch.trim() || undefined,
        mime_type: mimeFilter,
        uploaded_date: dateFilter || undefined,
      });
      setPhotos(res.items);
      setPhotosTotalBytes(res.total_bytes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event photographs.");
    } finally {
      setPhotosLoading(false);
    }
  }, [eventUid, photoSearch, mimeFilter, dateFilter]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadPhotos();
    }, 150);
    return () => clearTimeout(t);
  }, [loadPhotos]);

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditSaving(true);
    setError(null);
    try {
      const updated = await adminApi.updateEvent(eventUid, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        event_date: editForm.event_date,
        start_time: editForm.start_time || null,
        end_time: editForm.end_time || null,
        location: editForm.location.trim() || null,
        organizer_name: editForm.organizer_name.trim() || null,
        organizer_contact: editForm.organizer_contact.trim() || null,
        status: editForm.status,
        accepting_photos: editForm.accepting_photos,
        enforce_time_window: editForm.enforce_time_window,
      });
      setEvent(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: EventStatus) => {
    setError(null);
    try {
      const updated = await adminApi.updateEventStatus(
        eventUid,
        nextStatus,
        nextStatus === "active"
      );
      setEvent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status.");
    }
  };

  const handleRetryStorage = async () => {
    setRetryingStorage(true);
    setError(null);
    try {
      const res = await adminApi.retryStorage(eventUid);
      setEvent(res.event);
      if (!res.provisioned) setError(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Storage retry failed.");
    } finally {
      setRetryingStorage(false);
    }
  };

  const handleTogglePhotoVisibility = async (photo: AdminPhoto) => {
    try {
      const updated = await adminApi.togglePhotoVisibility(photo.photo_id, !photo.is_public);
      setPhotos((prev) => prev.map((p) => (p.photo_id === photo.photo_id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update photo visibility.");
    }
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    setError(null);
    try {
      if (confirmDialog.kind === "archive-event") {
        const updated = await adminApi.archiveEvent(eventUid);
        setEvent(updated);
      } else if (confirmDialog.kind === "delete-event") {
        await adminApi.deleteEvent(eventUid);
        navigate("/admin/events", { replace: true });
        return;
      } else if (confirmDialog.kind === "delete-photo") {
        await adminApi.deletePhoto(confirmDialog.photo.photo_id);
        await Promise.all([loadEvent(), loadPhotos()]);
      }
      setConfirmDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed.");
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p className="font-semibold">{error || "Event not found."}</p>
        <Link to="/admin/events" className="mt-3 inline-block text-sm font-semibold underline">
          Return to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/events"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All Events
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{event.name}</h1>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(event.status)}`}
            >
              {event.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {formatDate(event.event_date)}
            {event.start_time ? ` · ${formatTime(event.start_time)}` : ""}
            {event.end_time ? ` – ${formatTime(event.end_time)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            {editing ? "Close Edit" : "Edit Details"}
          </button>

          {event.status !== "active" && event.status !== "archived" && (
            <button
              type="button"
              onClick={() => void handleStatusChange("active")}
              className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Activate Event
            </button>
          )}
          {event.status === "active" && (
            <button
              type="button"
              onClick={() => void handleStatusChange("inactive")}
              className="inline-flex min-h-11 items-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
            >
              Deactivate
            </button>
          )}
          {event.status !== "archived" && (
            <button
              type="button"
              onClick={() => setConfirmDialog({ kind: "archive-event" })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDialog({ kind: "delete-event" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete Event
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Edit Form */}
      {editing && (
        <form
          onSubmit={handleSaveEdit}
          className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-6 shadow-xs"
        >
          <h2 className="text-lg font-bold text-slate-900">Edit Event Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700">
                Event Name
              </label>
              <input
                id="edit-name"
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-desc" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="edit-desc"
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-date" className="block text-sm font-medium text-slate-700">
                Event Date
              </label>
              <input
                id="edit-date"
                type="date"
                required
                value={editForm.event_date}
                onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                id="edit-status"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EventStatus })}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-start" className="block text-sm font-medium text-slate-700">
                Start Time
              </label>
              <input
                id="edit-start"
                type="time"
                value={editForm.start_time}
                onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-end" className="block text-sm font-medium text-slate-700">
                End Time
              </label>
              <input
                id="edit-end"
                type="time"
                value={editForm.end_time}
                onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-location" className="block text-sm font-medium text-slate-700">
                Location
              </label>
              <input
                id="edit-location"
                type="text"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-org-name" className="block text-sm font-medium text-slate-700">
                Organizer Name
              </label>
              <input
                id="edit-org-name"
                type="text"
                value={editForm.organizer_name}
                onChange={(e) => setEditForm({ ...editForm, organizer_name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div>
              <label htmlFor="edit-org-contact" className="block text-sm font-medium text-slate-700">
                Organizer Contact
              </label>
              <input
                id="edit-org-contact"
                type="tel"
                value={editForm.organizer_contact}
                onChange={(e) => setEditForm({ ...editForm, organizer_contact: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2"
              />
            </div>
            <div className="flex flex-col justify-center gap-2 pt-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.accepting_photos}
                  onChange={(e) => setEditForm({ ...editForm, accepting_photos: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Allow new photo uploads
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.enforce_time_window}
                  onChange={(e) => setEditForm({ ...editForm, enforce_time_window: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Enforce Start/End time window
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Phase 3 & 4: Credentials + R2 Storage Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">Event Access Credentials</h2>
          {event.access_code ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                  Event Access Code
                </p>
                <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.22em] text-slate-900">
                  {event.access_code}
                </p>
              </div>
              <CopyButton value={event.access_code} label="Copy Code" />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Access code will be generated once the Cloudflare R2 bucket is provisioned and verified.
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Event ID</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">{event.event_uid}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Event Date</dt>
              <dd className="mt-0.5 font-medium text-slate-800">{formatDate(event.event_date)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Organizer</dt>
              <dd className="mt-0.5 text-slate-800">{event.organizer_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Contact</dt>
              <dd className="mt-0.5 text-slate-800">{event.organizer_contact || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">Cloudflare R2 Storage</h2>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(
                event.storage?.provisioning_status || "pending"
              )}`}
            >
              {event.storage?.is_verified && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {event.storage?.provisioning_status || "pending"}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">Storage Bucket Name</dt>
              <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                {event.storage?.bucket_name || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Photos Stored</dt>
              <dd className="mt-0.5 text-lg font-bold text-slate-900">{event.storage?.total_photos ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Storage Used</dt>
              <dd className="mt-0.5 text-lg font-bold text-slate-900">
                {formatBytes(event.storage?.total_bytes ?? 0)}
              </dd>
            </div>
          </dl>

          {event.storage?.provisioning_status !== "provisioned" && (
            <div className="mt-4 space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-2 text-xs text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{event.storage?.last_error || "Bucket has not been verified yet."}</span>
              </div>
              <button
                type="button"
                disabled={retryingStorage}
                onClick={() => void handleRetryStorage()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retryingStorage ? "animate-spin" : ""}`} aria-hidden="true" />
                {retryingStorage ? "Retrying..." : "Retry R2 Bucket Provisioning"}
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Phase 10: Admin Photo Management */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Event Photographs ({photos.length})</h2>
            <p className="text-xs text-slate-500">
              Filtered storage total: {formatBytes(photosTotalBytes)}
            </p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <search className="mt-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadPhotos();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <div className="relative">
              <label htmlFor="photo-search" className="visually-hidden">
                Search photographs
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="photo-search"
                type="search"
                value={photoSearch}
                onChange={(e) => setPhotoSearch(e.target.value)}
                placeholder="Search by Photo ID or filename..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm"
              />
            </div>

            <div>
              <label htmlFor="photo-mime-filter" className="visually-hidden">
                Filter by file format
              </label>
              <select
                id="photo-mime-filter"
                value={mimeFilter}
                onChange={(e) => setMimeFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="all">All Formats</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>

            <div>
              <label htmlFor="photo-date-filter" className="visually-hidden">
                Filter by upload date
              </label>
              <input
                id="photo-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
            </div>
          </form>
        </search>

        {photosLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : photos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-10 text-center">
            <ImageIcon className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-slate-800">No photographs uploaded yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Guests can enter access code{" "}
              <span className="font-mono font-semibold text-slate-800">{event.access_code || "—"}</span> on
              the public portal to capture and upload photos.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <article
                key={photo.photo_id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img
                    src={resolveApiUrl(photo.image_url)}
                    alt={`${photo.event_name} — ${photo.photo_id}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute top-2.5 left-2.5 rounded-lg bg-slate-950/75 px-2.5 py-1 font-mono text-xs font-semibold text-white backdrop-blur-xs">
                    {photo.photo_id}
                  </span>
                  <span
                    className={`absolute top-2.5 right-2.5 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                      photo.is_public ? "bg-emerald-600/90 text-white" : "bg-slate-700/90 text-white"
                    }`}
                  >
                    {photo.is_public ? "Public QR" : "Hidden"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p className="truncate text-xs font-medium text-slate-700" title={photo.object_key}>
                      {photo.stored_filename}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(photo.uploaded_at)} · {formatBytes(photo.file_size)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">QR views: {photo.scan_count}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {photo.qr_image_url && photo.qr_target_url && (
                      <button
                        type="button"
                        onClick={() => setQrPhoto(photo)}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                        QR Code
                      </button>
                    )}
                    <a
                      href={resolveApiUrl(photo.download_url)}
                      download={photo.stored_filename}
                      title="Download photograph"
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleTogglePhotoVisibility(photo)}
                      title={photo.is_public ? "Hide from public QR" : "Make public via QR"}
                      aria-label={photo.is_public ? "Hide from public QR" : "Make public via QR"}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {photo.is_public ? (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDialog({ kind: "delete-photo", photo })}
                      title="Delete photograph"
                      aria-label={`Delete ${photo.photo_id}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {qrPhoto && qrPhoto.qr_image_url && qrPhoto.qr_target_url && (
        <QrModal
          open={true}
          photoId={qrPhoto.photo_id}
          eventName={qrPhoto.event_name}
          qrImageUrl={qrPhoto.qr_image_url}
          targetUrl={qrPhoto.qr_target_url}
          onClose={() => setQrPhoto(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog !== null}
        title={
          confirmDialog?.kind === "delete-photo"
            ? `Delete photograph ${confirmDialog.photo.photo_id}?`
            : confirmDialog?.kind === "archive-event"
              ? `Archive "${event.name}"?`
              : `Delete "${event.name}" and its R2 bucket?`
        }
        description={
          confirmDialog?.kind === "delete-photo"
            ? "This will permanently remove the image from Cloudflare R2 storage and invalidate its QR code."
            : confirmDialog?.kind === "archive-event"
              ? "Archiving disables public access and hides the event's QR photo links while keeping stored files."
              : "This permanently deletes the event, all photo metadata, QR codes, and removes the Cloudflare R2 bucket and objects."
        }
        confirmLabel={
          confirmDialog?.kind === "delete-photo"
            ? "Delete Photograph"
            : confirmDialog?.kind === "archive-event"
              ? "Archive Event"
              : "Delete Event"
        }
        tone={confirmDialog?.kind === "archive-event" ? "warning" : "danger"}
        busy={confirmBusy}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={() => void handleConfirmDialog()}
      />
    </div>
  );
}

