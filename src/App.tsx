/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import LandingPage from "./pages/landing";
import AuthPage from "./pages/auth/auth";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import VerifyEmailPage from "./pages/auth/verify-email";
import AuthCallbackPage from "./pages/auth/callback";

import AdminOverview from "./pages/dashboard/admin/overview";
import AdminUsersPage from "./pages/dashboard/admin/user";
import AdminAnalytics from "./pages/dashboard/admin/analytics";
import AdminMessages from "./pages/dashboard/admin/message";
import AdminSettings from "./pages/dashboard/admin/settings";

import CounselorOverview from "./pages/dashboard/counselor/overview";
import CounselorIntake from "./pages/dashboard/counselor/intake";
import CounselorAppointments from "./pages/dashboard/counselor/appointments";
import CounselorMessages from "./pages/dashboard/counselor/messages";
import CounselorSettings from "./pages/dashboard/counselor/settings";
import CounselorUsers from "./pages/dashboard/counselor/users";
import CounselorAnalytics from "./pages/dashboard/counselor/analytics";

// ✅ NEW: Referral module pages (Counselor)
import CounselorReferrals from "./pages/dashboard/counselor/referrals";
import CounselorReferralDetails from "./pages/dashboard/counselor/referral-details";

// ✅ NEW: Hardcopy assessment score encoding pages (Counselor)
import CounselorCaseLoad from "./pages/dashboard/counselor/case-load";
import CounselorAssessmentScoreInput from "./pages/dashboard/counselor/assessment-score-input";

// ✅ NEW: Assessment report page (Counselor)
import CounselorAssessmentReport from "./pages/dashboard/counselor/assessment-report";

// ✅ NEW: Referral-user pages
import ReferralUserMessages from "./pages/dashboard/referral-user/messages";
import ReferralUserReferrals from "./pages/dashboard/referral-user/referrals";

import StudentOverview from "./pages/dashboard/student/overview";
import StudentIntake from "./pages/dashboard/student/intake";
import StudentEvaluation from "./pages/dashboard/student/evaluation";
import StudentMessages from "./pages/dashboard/student/messages";
import StudentSettings from "./pages/dashboard/student/settings";

import NotFoundPage from "./pages/404";
import Loading from "./components/Loading";
import { Toaster } from "./components/ui/sonner";

import { getCurrentSession } from "@/lib/authentication";
import { normalizeRole, resolveDashboardPathForRole } from "@/lib/role";

function isEmailVerified(u: any): boolean {
  if (!u) return false;
  if (u?.email_verified_at) return true;
  if (typeof u?.email_verified === "boolean") return u.email_verified;
  if (typeof u?.verified === "boolean") return u.verified;
  return false;
}

/**
 * Route guard:
 * - Requires auth session
 * - Requires email verified
 * - Requires role in allowedRoles
 * If blocked → redirects to the correct place.
 */
function RequireRole({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactElement;
}) {
  const location = useLocation();
  const session = getCurrentSession();
  const user = session.user;

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  // Email not verified
  if (!isEmailVerified(user)) {
    const email = typeof user.email === "string" ? user.email : "";
    return <Navigate to={`/auth/verify-email?email=${encodeURIComponent(email)}`} replace />;
  }

  const role = normalizeRole(user.role ?? "");

  const allowed = allowedRoles.some((r) => role.includes(r));
  if (!allowed) {
    // Redirect them back to their own dashboard root
    const home = resolveDashboardPathForRole(user.role ?? "");
    return <Navigate to={home} replace />;
  }

  return children;
}

function DashboardIndexRoute() {
  const session = getCurrentSession();
  const user = session.user;

  if (!user) return <Navigate to="/auth" replace />;

  // If somehow they have a session but not verified, always push to verify
  if (!isEmailVerified(user)) {
    const email = typeof user.email === "string" ? user.email : "";
    return <Navigate to={`/auth/verify-email?email=${encodeURIComponent(email)}`} replace />;
  }

  const dashboardPath = resolveDashboardPathForRole(user.role ?? null);
  return <Navigate to={dashboardPath} replace />;
}

function SettingsIndexRoute() {
  const session = getCurrentSession();
  const user = session.user;

  if (!user) return <Navigate to="/auth" replace />;

  if (!isEmailVerified(user)) {
    const email = typeof user.email === "string" ? user.email : "";
    return <Navigate to={`/auth/verify-email?email=${encodeURIComponent(email)}`} replace />;
  }

  const role = normalizeRole(user.role ?? "");

  // Admin
  if (role.includes("admin")) {
    return <Navigate to="/dashboard/admin/settings" replace />;
  }

  // Student + guest
  if (role.includes("student") || role.includes("guest")) {
    return <Navigate to="/dashboard/student/settings" replace />;
  }

  // Counselor
  if (role.includes("counselor") || role.includes("counsellor")) {
    return <Navigate to="/dashboard/counselor/settings" replace />;
  }

  // Otherwise go to their dashboard home
  const dashboardPath = resolveDashboardPathForRole(user.role ?? null);
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

          {/* Centralized settings entry point */}
          <Route path="/dashboard/settings" element={<SettingsIndexRoute />} />

          {/* Admin routes (admin only) */}
          <Route
            path="/dashboard/admin"
            element={
              <RequireRole allowedRoles={["admin"]}>
                <AdminOverview />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/admin/users"
            element={
              <RequireRole allowedRoles={["admin"]}>
                <AdminUsersPage />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/admin/analytics"
            element={
              <RequireRole allowedRoles={["admin"]}>
                <AdminAnalytics />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/admin/messages"
            element={
              <RequireRole allowedRoles={["admin"]}>
                <AdminMessages />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/admin/settings"
            element={
              <RequireRole allowedRoles={["admin"]}>
                <AdminSettings />
              </RequireRole>
            }
          />

          {/* Counselor routes (counselor only) */}
          <Route
            path="/dashboard/counselor"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorOverview />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/counselor/intake"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorIntake />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/counselor/appointments"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorAppointments />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/counselor/messages"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorMessages />
              </RequireRole>
            }
          />

          {/* ✅ Counselor referrals list */}
          <Route
            path="/dashboard/counselor/referrals"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorReferrals />
              </RequireRole>
            }
          />

          {/* ✅ Counselor referral details */}
          <Route
            path="/dashboard/counselor/referrals/:id"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorReferralDetails />
              </RequireRole>
            }
          />

          {/* ✅ Counselor case load */}
          <Route
            path="/dashboard/counselor/case-load"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorCaseLoad />
              </RequireRole>
            }
          />

          {/* ✅ Counselor hardcopy assessment score input */}
          <Route
            path="/dashboard/counselor/assessment-score-input"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorAssessmentScoreInput />
              </RequireRole>
            }
          />

          {/* ✅ FIX: Counselor assessment report page (this was missing → caused 404) */}
          <Route
            path="/dashboard/counselor/assessment-report"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorAssessmentReport />
              </RequireRole>
            }
          />

          <Route
            path="/dashboard/counselor/users"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorUsers />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/counselor/analytics"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorAnalytics />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/counselor/settings"
            element={
              <RequireRole allowedRoles={["counselor", "counsellor"]}>
                <CounselorSettings />
              </RequireRole>
            }
          />

          {/* ✅ Referral-user routes (referral user only) */}
          {/* Default referral-user entry → referrals list */}
          <Route
            path="/dashboard/referral-user"
            element={
              <RequireRole
                allowedRoles={[
                  "referral-user",
                  "referral_user",
                  "referraluser",
                  "referral",
                ]}
              >
                <ReferralUserReferrals />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/referral-user/referrals"
            element={
              <RequireRole
                allowedRoles={[
                  "referral-user",
                  "referral_user",
                  "referraluser",
                  "referral",
                ]}
              >
                <ReferralUserReferrals />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/referral-user/messages"
            element={
              <RequireRole
                allowedRoles={[
                  "referral-user",
                  "referral_user",
                  "referraluser",
                  "referral",
                ]}
              >
                <ReferralUserMessages />
              </RequireRole>
            }
          />

          {/* Student routes (student + guest only) */}
          <Route
            path="/dashboard/student"
            element={
              <RequireRole allowedRoles={["student", "guest"]}>
                <StudentOverview />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/student/intake"
            element={
              <RequireRole allowedRoles={["student", "guest"]}>
                <StudentIntake />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/student/messages"
            element={
              <RequireRole allowedRoles={["student", "guest"]}>
                <StudentMessages />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/student/evaluation"
            element={
              <RequireRole allowedRoles={["student", "guest"]}>
                <StudentEvaluation />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard/student/settings"
            element={
              <RequireRole allowedRoles={["student", "guest"]}>
                <StudentSettings />
              </RequireRole>
            }
          />

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
