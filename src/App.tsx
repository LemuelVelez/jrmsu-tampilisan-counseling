import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/landing";
import AuthPage from "./pages/auth/auth";
import ForgotPasswordPage from "./pages/auth/forgot-password";
import ResetPasswordPage from "./pages/auth/reset-password";
import VerifyEmailPage from "./pages/auth/verify-email";
import AuthCallbackPage from "./pages/auth/callback";
import AdminOverview from "./pages/dashboard/admin/overview";
import CounselorOverview from "./pages/dashboard/counselor/overview";
import StudentOverview from "./pages/dashboard/student/overview";
import NotFoundPage from "./pages/404";
import Loading from "./components/Loading";
import { Toaster } from "./components/ui/sonner";

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

          {/* Dashboards (do not modify actual page files) */}
          <Route path="/dashboard/admin" element={<AdminOverview />} />
          <Route path="/dashboard/counselor" element={<CounselorOverview />} />
          <Route path="/dashboard/student" element={<StudentOverview />} />

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
