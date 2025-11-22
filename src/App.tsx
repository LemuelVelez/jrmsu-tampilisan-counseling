import { BrowserRouter, Routes, Route } from "react-router-dom";

import LandingPage from "./pages/landing";
import AuthPage from "./pages/auth/auth";
import AdminOverview from "./pages/dashboard/admin/overview";
import CounselorOverview from "./pages/dashboard/counselor/overview";
import StudentOverview from "./pages/dashboard/student/overview";
import NotFoundPage from "./pages/404";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Dashboards (do not modify actual page files) */}
        <Route path="/dashboard/admin" element={<AdminOverview />} />
        <Route path="/dashboard/counselor" element={<CounselorOverview />} />
        <Route path="/dashboard/student" element={<StudentOverview />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
