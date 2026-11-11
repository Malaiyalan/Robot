import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  RefreshCw,
} from "lucide-react";
import { CopyButton } from "../components/CopyButton";
import { adminApi } from "../lib/api";
import { formatDate, statusBadgeClasses } from "../lib/format";
import type { EventProvisionResponse, EventStatus } from "../types/api";

function todayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function AdminCreateEventPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(todayLocalISO());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("22:00");
  const [location, setLocation] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [organizerContact, setOrganizerContact] = useState("");
  const [status, setStatus] = useState<EventStatus>("active");
  const [enforceTimeWindow, setEnforceTimeWindow] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventProvisionResponse | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Event Name must be at least 2 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await adminApi.createEvent({
        name: name.trim(),
        description: description.trim() || null,
        event_date: eventDate,
        start_time: startTime || null,
        end_time: endTime || null,
        location: location.trim() || null,
        organizer_name: organizerName.trim() || null,
        organizer_contact: organizerContact.trim() || null,
        status,
        accepting_photos: status === "active",
        enforce_time_window: enforceTimeWindow,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryProvisioning = async () => {
    if (!result) return;
    setRetrying(true);
    setError(null);
    try {
      const res = await adminApi.retryStorage(result.event.event_uid);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setError(null);
    setName("");
    setDescription("");
    setLocation("");
    setOrganizerName("");
    setOrganizerContact("");
    setStatus("active");
    setEnforceTimeWindow(false);
  };

  // Phase 3 & 4: Creation Success / Provisioning Retry View
  if (result) {
    const ev = result.event;
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          to="/admin/events"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to All Events
        </Link>

        {result.provisioned ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Event Created & R2 Verified</h1>
                <p className="text-sm text-slate-600">{result.message}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                    10-Character Event Access Code
                  </p>
                  <p className="mt-1 font-mono text-3xl font-extrabold tracking-[0.25em] text-slate-900">
                    {ev.access_code}
                  </p>
                </div>
                {ev.access_code && <CopyButton value={ev.access_code} label="Copy Code" />}
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event Name</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{ev.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event ID</dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">{ev.event_uid}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event Date</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{formatDate(ev.event_date)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Storage Bucket Name
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  {ev.storage?.bucket_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(ev.status)}`}
                  >
                    {ev.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">R2 Region</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{ev.storage?.region || "auto"}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/admin/events/${encodeURIComponent(ev.event_uid)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Open Event Management
              </Link>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Create Another Event
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Event Saved — Cloudflare R2 Bucket Provisioning Failed
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  The event <span className="font-semibold">{ev.name}</span> was saved, but bucket{" "}
                  <span className="font-mono font-semibold">{ev.storage?.bucket_name}</span> was not
                  marked provisioned and no access code was issued.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {ev.storage?.last_error || result.message}
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={retrying}
                onClick={() => void handleRetryProvisioning()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden="true" />
                {retrying ? "Retrying R2 Bucket Creation..." : "Retry Storage Provisioning"}
              </button>
              <Link
                to={`/admin/events/${encodeURIComponent(ev.event_uid)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View Event Details
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Create New Event
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Creates the event record, provisions a dedicated Cloudflare R2 bucket, and generates a 10-character access code.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="ev-name" className="block text-sm font-semibold text-slate-800">
              Event Name <span className="text-rose-600">*</span>
            </label>
            <input
              id="ev-name"
              name="name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Day 2026"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ev-desc" className="block text-sm font-semibold text-slate-800">
              Event Description
            </label>
            <textarea
              id="ev-desc"
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of the photography event..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ev-date" className="block text-sm font-semibold text-slate-800">
              Event Date <span className="text-rose-600">*</span>
            </label>
            <input
              id="ev-date"
              name="event_date"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ev-status" className="block text-sm font-semibold text-slate-800">
              Event Status
            </label>
            <select
              id="ev-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label htmlFor="ev-start-time" className="block text-sm font-semibold text-slate-800">
              Event Start Time
            </label>
            <input
              id="ev-start-time"
              name="start_time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ev-end-time" className="block text-sm font-semibold text-slate-800">
              Event End Time
            </label>
            <input
              id="ev-end-time"
              name="end_time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ev-location" className="block text-sm font-semibold text-slate-800">
              Event Location
            </label>
            <input
              id="ev-location"
              name="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Grand Ballroom, Convention Center"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ev-org-name" className="block text-sm font-semibold text-slate-800">
              Event Organizer Name
            </label>
            <input
              id="ev-org-name"
              name="organizer_name"
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              placeholder="Organizer full name"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ev-org-contact" className="block text-sm font-semibold text-slate-800">
              Organizer Contact Number
            </label>
            <input
              id="ev-org-contact"
              name="organizer_contact"
              type="tel"
              value={organizerContact}
              onChange={(e) => setOrganizerContact(e.target.value)}
              placeholder="+1 555 010 2026"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900"
            />
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <input
            id="ev-enforce-window"
            type="checkbox"
            checked={enforceTimeWindow}
            onChange={(e) => setEnforceTimeWindow(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          <div>
            <label htmlFor="ev-enforce-window" className="text-sm font-semibold text-slate-800">
              Enforce strict Event Date & Start/End Time window for guest uploads
            </label>
            <p className="text-xs text-slate-500">
              When checked, guests can enter the access code only on the Event Date between Start Time and End Time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs text-indigo-900">
          <Cloud className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
          <span>
            Cloudflare R2 will automatically provision an isolated bucket sanitized from your Event Name.
          </span>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Link
            to="/admin/events"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Creating Event & R2 Bucket..." : "Create Event"}
          </button>
        </div>
      </form>
    </div>
  );
}

