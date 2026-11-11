import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import { AdminCreateEventPage } from "./pages/AdminCreateEventPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AdminEventDetailPage } from "./pages/AdminEventDetailPage";
import { AdminEventsPage } from "./pages/AdminEventsPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { CameraCapturePage } from "./pages/CameraCapturePage";
import { PublicAccessPage } from "./pages/PublicAccessPage";
import { PublicPhotoViewPage } from "./pages/PublicPhotoViewPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Photography Experience */}
        <Route path="/" element={<PublicAccessPage />} />
        <Route path="/capture" element={<CameraCapturePage />} />
        <Route path="/photos/:photoId" element={<PublicPhotoViewPage />} />

        {/* Super Admin Experience */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/admin/events/new" element={<AdminCreateEventPage />} />
            <Route path="/admin/events/:eventUid" element={<AdminEventDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

