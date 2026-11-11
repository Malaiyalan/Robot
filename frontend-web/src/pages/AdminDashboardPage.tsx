import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  HardDrive,
  Image as ImageIcon,
  PlusCircle,
} from "lucide-react";
import { adminApi } from "../lib/api";
import { formatBytes, formatDate, statusBadgeClasses } from "../lib/format";
import type { DashboardStats } from "../types/api";

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableTitleId = useId();

  useEffect(() => {
    let mounted = true;
    adminApi
      .dashboard()
      .then((res) => {
        if (mounted) setStats(res);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
          <span>{error || "Unable to load dashboard metrics."}</span>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Events",
      value: String(stats.total_events),
      icon: Calendar,
      tone: "bg-slate-100 text-slate-700",
    },
    {
      label: "Active Events",
      value: String(stats.active_events),
      icon: Activity,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Completed Events",
      value: String(stats.completed_events),
      icon: CheckCircle2,
      tone: "bg-indigo-100 text-indigo-700",
    },
    {
      label: "Total Photos Uploaded",
      value: String(stats.total_photos_uploaded),
      icon: ImageIcon,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Total Storage Used",
      value: formatBytes(stats.total_storage_bytes),
      icon: HardDrive,
      tone: "bg-sky-100 text-sky-700",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Super Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor event photography sessions, Cloudflare R2 buckets, and uploaded media.
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

      {/* Metrics Grid */}
      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          );
        })}
      </section>

      {/* Recent Events */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id={tableTitleId} className="text-lg font-bold text-slate-900">
            Recent Events
          </h2>
          <Link to="/admin/events" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            View All Events →
          </Link>
        </div>

        {stats.recent_events.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-slate-800">No events created yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first event to automatically provision a Cloudflare R2 bucket and generate an access code.
            </p>
            <Link
              to="/admin/events/new"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create New Event
            </Link>
          </div>
        ) : (
          <div tabIndex={0} role="region" aria-labelledby={tableTitleId} className="table-wrapper p-2 sm:p-0">
            <table className="responsive-table text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Event</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Access Code</th>
                  <th className="px-4 py-3.5">R2 Bucket</th>
                  <th className="px-4 py-3.5">Photos</th>
                  <th className="px-4 py-3.5">Storage</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recent_events.map((ev) => (
                  <tr key={ev.event_uid} className="hover:bg-slate-50/70">
                    <th className="px-5 py-3.5 font-semibold text-slate-900">
                      <div>
                        <p>{ev.name}</p>
                        <p className="font-mono text-xs font-normal text-slate-500">{ev.event_uid}</p>
                      </div>
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
                        <span className="text-xs text-amber-700">Pending R2</span>
                      )}
                    </td>
                    <td data-label="R2 Bucket" className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-700">
                        {ev.storage?.bucket_name || "—"}
                      </span>
                    </td>
                    <td data-label="Photos" className="px-4 py-3.5 font-medium text-slate-800">
                      {ev.storage?.total_photos ?? 0}
                    </td>
                    <td data-label="Storage" className="px-4 py-3.5 text-slate-600">
                      {formatBytes(ev.storage?.total_bytes ?? 0)}
                    </td>
                    <td data-label="Status" className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(ev.status)}`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td data-label="Action" className="px-5 py-3.5 text-right">
                      <Link
                        to={`/admin/events/${encodeURIComponent(ev.event_uid)}`}
                        className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

