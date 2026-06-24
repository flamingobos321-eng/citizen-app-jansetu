import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import CitizenLogin from "./pages/CitizenLogin";
import CitizenRegister from "./pages/CitizenRegister";
import StaffLogin from "./pages/StaffLogin";
import Layout from "./components/Layout";

import CitizenHome from "./pages/CitizenHome";
import CitizenProfile from "./pages/CitizenProfile";
import RaiseIssue from "./pages/RaiseIssue";
import IssuesList from "./pages/IssuesList";
import IssueDetail from "./pages/IssueDetail";
import Notifications from "./pages/Notifications";
import Visits from "./pages/Visits";
import DevWorks from "./pages/DevWorks";
import StaffDashboard from "./pages/StaffDashboard";
import CitizensList from "./pages/CitizensList";
import AdminAreas from "./pages/AdminAreas";
import AdminStaff from "./pages/AdminStaff";
import Celebrations from "./pages/Celebrations";

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === "citizen") return <CitizenHome />;
  if (user?.role === "worker") return <IssuesList />;
  return <StaffDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/citizen/login" element={<CitizenLogin />} />
          <Route path="/citizen/register" element={<CitizenRegister />} />
          <Route path="/staff/login" element={<StaffLogin />} />

          <Route path="/app" element={<Guard><HomeRoute /></Guard>} />
          <Route path="/app/raise" element={<Guard><RaiseIssue /></Guard>} />
          <Route path="/app/profile" element={<Guard><CitizenProfile /></Guard>} />
          <Route path="/app/my-issues" element={<Guard><IssuesList /></Guard>} />
          <Route path="/app/issues" element={<Guard><IssuesList /></Guard>} />
          <Route path="/app/issues/:id" element={<Guard><IssueDetail /></Guard>} />
          <Route path="/app/notifications" element={<Guard><Notifications /></Guard>} />
          <Route path="/app/visits" element={<Guard><Visits /></Guard>} />
          <Route path="/app/devworks" element={<Guard><DevWorks /></Guard>} />
          <Route path="/app/citizens" element={<Guard><CitizensList /></Guard>} />
          <Route path="/app/celebrations" element={<Guard><Celebrations /></Guard>} />
          <Route path="/app/areas" element={<Guard><AdminAreas /></Guard>} />
          <Route path="/app/staff" element={<Guard><AdminStaff /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
