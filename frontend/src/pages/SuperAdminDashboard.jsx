import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Crown, Globe, Users, ShieldCheck, FileText, Calendar, Bell, Hammer, CreditCard, Timer, Plus, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [portals, setPortals] = useState([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.get("/platform/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/admin/portals").then((r) => setPortals(r.data || [])).catch(() => {});
  }, []);

  const runEscalations = async () => {
    setRunning(true);
    try {
      const r = await api.post("/admin/issues/run-escalations");
      const n = r.data?.escalated?.length ?? 0;
      toast.success(`Escalation pass complete — ${n} issue(s) escalated. Scanned ${r.data?.scanned ?? 0}.`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setRunning(false);
    }
  };

  if (user && user.role !== "super_admin") {
    return <div className="p-8"><EmptyState title="Super Admin only" hint="This area is restricted to platform administrators." /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-amber-600">
            <Crown size={16} />
            <span className="text-[11px] font-bold uppercase tracking-widest">Platform Console</span>
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-1">Platform Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Cross-tenant platform health. Per-tenant data is not visible here by design.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runEscalations}
            disabled={running}
            data-testid="run-escalations-btn"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-60"
            title="Fires the 3d→worker / 7d→PA / 15d→MLA escalation loop once."
          >
            <AlertTriangle size={14} /> {running ? "Running…" : "Run Escalations"}
          </button>
          <Link to="/app/portals" data-testid="super-new-portal" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90">
            <Plus size={16} /> Manage Portals
          </Link>
        </div>
      </div>

      {/* PORTAL SUMMARY */}
      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-3">Client Portals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Globe} label="Total Portals" value={stats?.portals?.total ?? "—"} color="#0A1128" />
          <StatCard icon={Globe} label="Active" value={stats?.portals?.active ?? "—"} color="#10B981" />
          <StatCard icon={Timer} label="On Trial" value={stats?.portals?.trial ?? "—"} color="#B45309" />
          <StatCard icon={Globe} label="Suspended" value={stats?.portals?.suspended ?? "—"} color="#DC2626" />
        </div>
      </section>

      {/* PLATFORM ENTITIES */}
      <section>
        <h2 className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-3">Platform-wide Counts</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Citizens" value={stats?.entities?.citizens ?? "—"} color="#0A1128" />
          <StatCard icon={ShieldCheck} label="Staff" value={stats?.entities?.staff ?? "—"} color="#0A1128" />
          <StatCard icon={FileText} label="Issues" value={stats?.entities?.issues ?? "—"} color="#B45309" />
          <StatCard icon={Calendar} label="Visits" value={stats?.entities?.visits ?? "—"} color="#0A1128" />
          <StatCard icon={Bell} label="Notifications" value={stats?.entities?.notifications ?? "—"} color="#0A1128" />
          <StatCard icon={Hammer} label="Dev Works" value={stats?.entities?.devworks ?? "—"} color="#10B981" />
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Aggregate counts only. Super admin cannot view per-tenant records.</p>
      </section>

      {/* PORTAL TABLE */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] uppercase tracking-widest font-bold text-gray-500">Portals at a glance</h2>
          <Link to="/app/portals" className="text-xs text-gray-500 hover:text-gray-900">View all →</Link>
        </div>
        {portals.length === 0 ? (
          <EmptyState title="No portals yet" hint="Create your first portal to onboard a client constituency." />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {portals.slice(0, 6).map((p) => <PortalSummaryRow key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* SUBSCRIPTION / TRIAL QUICK CARDS */}
      <section className="grid md:grid-cols-2 gap-4">
        <SoftCard
          icon={CreditCard}
          title="Subscription Management"
          desc="Paid plans, billing cycles, expiry reminders."
          to="/app/subscriptions"
          stat={`${stats?.portals?.active ?? 0} active`}
        />
        <SoftCard
          icon={Timer}
          title="Trial Management"
          desc="Trial tenants, expiry dates and conversion."
          to="/app/trials"
          stat={`${stats?.portals?.trial ?? 0} on trial`}
        />
      </section>
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</div>
      <Icon size={14} style={{ color }} />
    </div>
    <div className="font-heading text-3xl font-bold mt-1" style={{ color }}>{value}</div>
  </div>
);

const PortalSummaryRow = ({ p }) => {
  const isSuspended = p.portal_status === "suspended";
  const isTrial = p.is_trial;
  return (
    <div className="p-4 flex items-center gap-3 flex-wrap" data-testid={`super-portal-row-${p.slug}`}>
      <div className="w-10 h-10 rounded-md flex items-center justify-center text-white font-heading text-base font-bold shrink-0" style={{ backgroundColor: p.theme_color || "#0A1128" }}>
        {(p.politician_name || "P").charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-heading font-semibold text-gray-900 truncate">{p.politician_name}</div>
        <div className="text-xs text-gray-500 truncate">{p.designation} · {p.constituency_name}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {p.is_default && <span className="pill pill-info">Default</span>}
        {isTrial && <span className="pill pill-warn">Trial</span>}
        {!p.is_active ? (
          <span className="pill pill-neutral">Inactive</span>
        ) : isSuspended ? (
          <span className="pill pill-overdue">Suspended</span>
        ) : (
          <span className="pill pill-resolved">Active</span>
        )}
        <a href={`/portal/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"><ExternalLink size={11} /> Open</a>
      </div>
    </div>
  );
};

const SoftCard = ({ icon: Icon, title, desc, to, stat }) => (
  <Link to={to} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition flex items-start gap-4">
    <div className="w-10 h-10 rounded-md bg-[#0A1128]/5 text-[#0A1128] flex items-center justify-center shrink-0">
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="font-heading font-semibold text-gray-900">{title}</div>
        <div className="text-xs font-bold text-gray-500">{stat}</div>
      </div>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </div>
  </Link>
);
