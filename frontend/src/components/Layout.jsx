import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  Bell,
  Hammer,
  Map,
  LogOut,
  Home,
  Plus,
  ShieldCheck,
  Cake,
  Globe,
} from "lucide-react";

const ROLE_LABEL = {
  citizen: "Citizen",
  worker: "Field Worker",
  pa: "PA / Staff",
  politician: "Representative",
  admin: "Super Admin",
};

function NavItem({ to, icon: Icon, label, testId }) {
  return (
    <NavLink
      to={to}
      data-testid={testId}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? "bg-[#0A1128] text-white"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/");
  };

  const isCitizen = user?.role === "citizen";
  const isAdmin = user?.role === "admin";
  const isMLA = user?.role === "politician";
  const isPA = user?.role === "pa";
  const isStaffAll = isAdmin || isMLA || isPA;
  const isWorker = user?.role === "worker";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden lg:flex flex-col">
        <div className="px-5 py-5 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2" data-testid="sidebar-logo">
            <div className="w-9 h-9 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">
              JS
            </div>
            <div>
              <div className="font-heading font-bold text-[#0A1128] leading-none">JANSETU</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mt-0.5">My Constituency</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {isCitizen && (
            <>
              <NavItem to="/app" icon={Home} label="Home" testId="nav-home" />
              <NavItem to="/app/raise" icon={Plus} label="Raise Issue" testId="nav-raise" />
              <NavItem to="/app/my-issues" icon={FileText} label="My Issues" testId="nav-my-issues" />
              <NavItem to="/app/visits" icon={Calendar} label="Upcoming Visits" testId="nav-visits" />
              <NavItem to="/app/notifications" icon={Bell} label="Notifications" testId="nav-notifs" />
              <NavItem to="/app/devworks" icon={Hammer} label="Development Works" testId="nav-devworks" />
              <NavItem to="/app/profile" icon={Users} label="My Profile" testId="nav-profile" />
            </>
          )}
          {isStaffAll && (
            <>
              <NavItem to="/app" icon={LayoutDashboard} label="Dashboard" testId="nav-dashboard" />
              <NavItem to="/app/issues" icon={FileText} label="All Issues" testId="nav-issues" />
              <NavItem to="/app/citizens" icon={Users} label="Citizens & Households" testId="nav-citizens" />
              <NavItem to="/app/visits" icon={Calendar} label="Visits" testId="nav-visits" />
              <NavItem to="/app/notifications" icon={Bell} label="Notifications" testId="nav-notifs" />
              <NavItem to="/app/devworks" icon={Hammer} label="Development Works" testId="nav-devworks" />
              <NavItem to="/app/celebrations" icon={Cake} label="Celebrations" testId="nav-celeb" />
              {isAdmin && (
                <>
                  <NavItem to="/app/areas" icon={Map} label="Wards & Villages" testId="nav-areas" />
                  <NavItem to="/app/staff" icon={ShieldCheck} label="Staff & Roles" testId="nav-staff" />
                  <NavItem to="/app/portals" icon={Globe} label="Client Portals" testId="nav-portals" />
                </>
              )}
            </>
          )}
          {isWorker && (
            <>
              <NavItem to="/app" icon={LayoutDashboard} label="My Assignments" testId="nav-dashboard" />
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-xs uppercase tracking-widest text-gray-500">{ROLE_LABEL[user?.role]}</div>
            <div className="text-sm font-semibold text-gray-900 truncate">{user?.name}</div>
          </div>
          <Button
            data-testid="logout-btn"
            variant="outline"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut size={16} className="mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-bold text-sm">JS</div>
            <span className="font-heading font-bold text-[#0A1128]">JANSETU</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={onLogout} data-testid="logout-btn-mobile">
            <LogOut size={16} />
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
