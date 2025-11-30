import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./pages/landing";
import AuthPage from "./pages/auth/auth";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import VerifyEmailPage from "./pages/auth/verify-email";
import AuthCallbackPage from "./pages/auth/callback";
import AdminOverview from "./pages/dashboard/admin/overview";
import CounselorOverview from "./pages/dashboard/counselor/overview";
import StudentOverview from "./pages/dashboard/student/overview";
import StudentIntake from "./pages/dashboard/student/intake";
import NotFoundPage from "./pages/404";
import Loading from "./components/Loading";
import { Toaster } from "./components/ui/sonner";
import { getCurrentSession } from "@/lib/authentication";
import { resolveDashboardPathForRole } from "@/lib/role";

function DashboardIndexRoute() {
  const session = getCurrentSession();
  const user = session.user;

  // No active session → send user to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const rawRole =
    typeof user.role === "string"
      ? user.role
      : user.role != null
        ? String(user.role)
        : null;

  const dashboardPath = resolveDashboardPathForRole(rawRole);

  return <Navigate to={dashboardPath} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Dashboard index – used by the "Dashboard" button */}
          <Route path="/dashboard" element={<DashboardIndexRoute />} />

          {/* Dashboards (do not modify actual page files) */}
          <Route path="/dashboard/admin" element={<AdminOverview />} />
          <Route path="/dashboard/counselor" element={<CounselorOverview />} />
          <Route path="/dashboard/student" element={<StudentOverview />} />
          <Route path="/dashboard/student/intake" element={<StudentIntake />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {/* Global Sonner toaster */}
      <Toaster richColors closeButton />
    </BrowserRouter>
  );
}

export default App;
