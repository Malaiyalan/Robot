import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { adminApi, tokenStore } from "../lib/api";
import type { AdminUser } from "../types/api";

export function ProtectedAdminRoute() {
  const [status, setStatus] = useState<"checking" | "authed" | "unauth">("checking");
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const token = tokenStore.getAdminToken();
    if (!token) {
      setStatus("unauth");
      return;
    }
    let mounted = true;
    adminApi
      .me()
      .then((user) => {
        if (!mounted) return;
        setAdmin(user);
        setStatus("authed");
      })
      .catch(() => {
        if (!mounted) return;
        tokenStore.clearAdminToken();
        setStatus("unauth");
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">Verifying Super Admin session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauth") {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet context={{ admin }} />;
}

