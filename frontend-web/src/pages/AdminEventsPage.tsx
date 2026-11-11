import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  Calendar,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { adminApi } from "../lib/api";
import { formatBytes, formatDate, statusBadgeClasses } from "../lib/format";
import type { EventItem, EventStatus } from "../types/api";

export function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "delete";
    event: EventItem;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const headingId = useId();

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listEvents({ search: search.trim() || undefined, status: statusFilter });
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEvents();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadEvents]);

  const handleToggleActive = async (ev: EventItem) => {
    const nextStatus: EventStatus = ev.status === "active" ? "inactive" : "active";
    try {
      await adminApi.updateEventStatus(ev.event_uid, nextStatus, nextStatus === "active");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update event status.");
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    try {
      if (confirmAction.type === "archive") {
        await adminApi.archiveEvent(confirmAction.event.event_uid);
      } else {
        await adminApi.deleteEvent(confirmAction.event.event_uid);
      }
      setConfirmAction(null);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      setConfirmAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 id={headingId} className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Events Management
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create events, inspect R2 bucket provisioning, toggle access, and manage photos.
          </p>
        </div>
        <Link
          to="/admin/events/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          Create New Event
        </Link>
      </div>

      {/* Filter Bar */}
      <search>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadEvents();
          }}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <label htmlFor="event-search" className="visually-hidden">
              Search events
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by event name, ID, location, or access code..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="sm:w-48">
            <label htmlFor="event-status-filter" className="visually-hidden">
              Filter by status
            </label>
            <select
              id="event-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </form>
      </search>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-slate-800">No matching events found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search query or create a new event.
            </p>
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby={headingId} className="table-wrapper p-2 sm:p-0">
            <table className="responsive-table text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Event</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Access Code</th>
                  <th className="px-4 py-3.5">R2 Storage</th>
                  <th className="px-4 py-3.5">Usage</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.event_uid} className="hover:bg-slate-50/70">
                    <th className="px-5 py-3.5 font-semibold text-slate-900">
                      <Link
                        to={`/admin/events/${encodeURIComponent(ev.event_uid)}`}
                        className="hover:text-indigo-600"
                      >
                        {ev.name}
                      </Link>
                      <p className="font-mono text-xs font-normal text-slate-500">{ev.event_uid}</p>
                    </th>
                    <td data-label="Date" className="px-4 py-3.5 text-slate-600">
                      {formatDate(ev.event_date)}
                    </td>
                    <td data-label="Access Code" className="px-4 py-3.5">
                      {ev.access_code ? (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-slate-800">
                          {ev.access_code}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-rose-600">Unprovisioned</span>
                      )}
                    </td>
                    <td data-label="R2 Storage" className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-slate-700">{ev.storage?.bucket_name || "—"}</span>
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${statusBadgeClasses(ev.storage?.provisioning_status || "pending")}`}
                        >
                          {ev.storage?.provisioning_status || "pending"}
                        </span>
                      </div>
                    </td>
                    <td data-label="Usage" className="px-4 py-3.5 text-slate-700">
                      <span className="font-medium">{ev.storage?.total_photos ?? 0}</span> photos ·{" "}
                      <span className="text-slate-500">{formatBytes(ev.storage?.total_bytes ?? 0)}</span>
                    </td>
                    <td data-label="Status" className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(ev.status)}`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td data-label="Actions" className="px-5 py-3.5">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/admin/events/${encodeURIComponent(ev.event_uid)}`}
                          className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                        >
                          Open
                        </Link>
                        {ev.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(ev)}
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            {ev.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {ev.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: "archive", event: ev })}
                            title="Archive event"
                            aria-label={`Archive ${ev.name}`}
                            className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: "delete", event: ev })}
                          title="Delete event"
                          aria-label={`Delete ${ev.name}`}
                          className="inline-flex min-h-9 items-center rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.type === "archive"
            ? `Archive "${confirmAction.event.name}"?`
            : `Permanently delete "${confirmAction?.event.name}"?`
        }
        description={
          confirmAction?.type === "archive"
            ? "Archiving marks the event unavailable for new captures and hides its public photos from QR scans while keeping all R2 objects intact."
            : "This permanently deletes the event record, all photo metadata, QR codes, and removes the Cloudflare R2 bucket and all stored photographs."
        }
        confirmLabel={confirmAction?.type === "archive" ? "Archive Event" : "Delete Event & R2 Bucket"}
        tone={confirmAction?.type === "archive" ? "warning" : "danger"}
        busy={actionBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
}

