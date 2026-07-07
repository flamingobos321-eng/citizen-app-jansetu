import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";

import Landing from "./pages/Landing";
import CitizenLogin from "./pages/CitizenLogin";
import CitizenRegister from "./pages/CitizenRegister";
import CitizenClaim from "./pages/CitizenClaim";
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
import AdminPortals from "./pages/AdminPortals";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperSubscriptions from "./pages/SuperSubscriptions";
import SuperTrials from "./pages/SuperTrials";
import Celebrations from "./pages/Celebrations";
import Reports from "./pages/Reports";
import PersonProfile from "./pages/PersonProfile";
import AdminKaryakartas from "./pages/AdminKaryakartas";
import AdminTaxonomy from "./pages/AdminTaxonomy";
import AdminElectoralRoll from "./pages/AdminElectoralRoll";
import PortalIndex from "./portal/PortalIndex";
import PortalHome from "./portal/PortalHome";
import ChangePassword from "./pages/ChangePassword";

function Guard({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  // Force password change for auto-provisioned admins on first login.
  if (user.must_change_password && loc.pathname !== "/app/change-password") {
    return <Navigate to="/app/change-password" replace />;
  }
  return <Layout>{children}</Layout>;
}

// Super admin should never see tenant-scoped pages. Redirect them to platform home.
function TenantGuard({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role === "super_admin") return <Navigate to="/app/platform" replace />;
  if (user.must_change_password && loc.pathname !== "/app/change-password") {
    return <Navigate to="/app/change-password" replace />;
  }
  return <Layout>{children}</Layout>;
}

// Super admin only.
function SuperGuard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== "super_admin") return <Navigate to="/app" replace />;
  return <Layout>{children}</Layout>;
}

// Standalone change-password page — does NOT use Layout (force first-login flow).
function ChangePasswordGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <ChangePassword />;
}

function HomeRoute() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <Navigate to="/app/platform" replace />;
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
          <Route path="/portal" element={<PortalIndex />} />
          <Route path="/portal/:slug" element={<PortalHome />} />
          {/* Canonical Office-Code URL (v1.1+). Matches /o/JS1045 and friends. */}
          <Route path="/o/:code" element={<PortalHome />} />
          <Route path="/citizen/login" element={<CitizenLogin />} />
          <Route path="/citizen/register" element={<CitizenRegister />} />
          <Route path="/citizen/claim" element={<CitizenClaim />} />
          <Route path="/staff/login" element={<StaffLogin />} />

          <Route path="/app" element={<Guard><HomeRoute /></Guard>} />
          <Route path="/app/change-password" element={<ChangePasswordGuard />} />
          <Route path="/app/platform" element={<SuperGuard><SuperAdminDashboard /></SuperGuard>} />
          <Route path="/app/subscriptions" element={<SuperGuard><SuperSubscriptions /></SuperGuard>} />
          <Route path="/app/trials" element={<SuperGuard><SuperTrials /></SuperGuard>} />
          <Route path="/app/portals" element={<SuperGuard><AdminPortals /></SuperGuard>} />

          <Route path="/app/raise" element={<TenantGuard><RaiseIssue /></TenantGuard>} />
          <Route path="/app/profile" element={<TenantGuard><CitizenProfile /></TenantGuard>} />
          <Route path="/app/my-issues" element={<TenantGuard><IssuesList /></TenantGuard>} />
          <Route path="/app/issues" element={<TenantGuard><IssuesList /></TenantGuard>} />
          <Route path="/app/issues/:id" element={<TenantGuard><IssueDetail /></TenantGuard>} />
          <Route path="/app/notifications" element={<TenantGuard><Notifications /></TenantGuard>} />
          <Route path="/app/visits" element={<TenantGuard><Visits /></TenantGuard>} />
          <Route path="/app/devworks" element={<TenantGuard><DevWorks /></TenantGuard>} />
          <Route path="/app/citizens" element={<TenantGuard><CitizensList /></TenantGuard>} />
          <Route path="/app/celebrations" element={<TenantGuard><Celebrations /></TenantGuard>} />
          <Route path="/app/reports" element={<TenantGuard><Reports /></TenantGuard>} />
          <Route path="/app/persons/:id" element={<TenantGuard><PersonProfile /></TenantGuard>} />
          <Route path="/app/areas" element={<TenantGuard><AdminAreas /></TenantGuard>} />
          <Route path="/app/staff" element={<TenantGuard><AdminStaff /></TenantGuard>} />
          <Route path="/app/karyakartas" element={<TenantGuard><AdminKaryakartas /></TenantGuard>} />
          <Route path="/app/taxonomy" element={<TenantGuard><AdminTaxonomy /></TenantGuard>} />
          <Route path="/app/electoral-roll" element={<TenantGuard><AdminElectoralRoll /></TenantGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
