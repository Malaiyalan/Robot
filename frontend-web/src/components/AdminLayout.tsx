import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useOutletContext } from "react-router-dom";
import {
  Calendar,
  Camera,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { adminApi, tokenStore } from "../lib/api";
import type { AdminUser } from "../types/api";

export function AdminLayout() {
  const { admin } = useOutletContext<{ admin: AdminUser | null }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await adminApi.logout();
    } catch {
      // Clear local session regardless
    } finally {
      tokenStore.clearAdminToken();
      navigate("/admin/login", { replace: true });
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-indigo-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link to="/admin" className="flex items-center gap-2.5 font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>EventLens Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-68 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0`}
      >
        <div className="hidden items-center gap-3 border-b border-slate-100 px-5 py-5 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">EventLens</p>
            <p className="text-xs font-medium text-slate-500">R2 Photography Studio</p>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex-1 space-y-1.5 p-4">
          <NavLink to="/admin" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/events" end className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            All Events
          </NavLink>
          <NavLink to="/admin/events/new" className={navLinkClass} onClick={() => setMobileOpen(false)}>
            <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Create New Event
          </NavLink>
          <div className="pt-3">
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>Public Guest Portal</span>
              <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </Link>
          </div>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{admin?.username || "Super Admin"}</p>
              <p className="text-xs text-slate-500">Super Administrator</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

