import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatCard, SectionTitle, StatusPill } from "../components/Common";
import { Plus, FileText, Calendar, Bell, Hammer, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";

export default function CitizenHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0 });
  const [recent, setRecent] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [visits, setVisits] = useState([]);

  useEffect(() => {
    api.get("/dashboard/citizen-stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/issues").then((r) => setRecent(r.data.slice(0, 5)));
    api.get("/notifications").then((r) => setNotifs(r.data.slice(0, 3)));
    api.get("/visits", { params: { upcoming: true } }).then((r) => setVisits(r.data.slice(0, 3)));
  }, []);

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Namaste</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-1">
            {user?.name}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{user?.address}</p>
        </div>
        <Link to="/app/raise" data-testid="raise-issue-cta">
          <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white">
            <Plus size={16} className="mr-2" /> Raise New Issue
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Issues" value={stats.total} testId="stat-total" />
        <StatCard label="Resolved" value={stats.resolved} accent="text-[#10B981]" testId="stat-resolved" />
        <StatCard label="Pending" value={stats.pending} accent="text-[#B45309]" testId="stat-pending" />
      </div>

      {/* Quick action cards */}
      <div>
        <SectionTitle subtitle="Quick actions for citizens">Services</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickCard to="/app/raise" icon={Plus} label="Raise Issue" testId="qa-raise" />
          <QuickCard to="/app/my-issues" icon={FileText} label="My Issues" testId="qa-issues" />
          <QuickCard to="/app/visits" icon={Calendar} label="Visits & Camps" testId="qa-visits" />
          <QuickCard to="/app/devworks" icon={Hammer} label="Dev Works" testId="qa-devworks" />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent issues */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-gray-900">Recent issues</h3>
            <Link to="/app/my-issues" className="text-xs font-semibold text-[#0A1128] flex items-center gap-1" data-testid="see-all-issues">
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recent.length === 0 && (
              <div className="p-6 text-sm text-gray-500">You haven't raised any issues yet.</div>
            )}
            {recent.map((i) => (
              <Link key={i.id} to={`/app/issues/${i.id}`} className="block p-4 hover:bg-gray-50 transition-colors" data-testid={`issue-row-${i.issue_code}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{i.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{i.issue_code} · {i.category}</div>
                  </div>
                  <StatusPill status={i.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Notifications + Visits */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-gray-900">Notifications</h3>
              <Bell size={16} className="text-gray-400" />
            </div>
            <div className="divide-y divide-gray-100">
              {notifs.length === 0 && <div className="p-6 text-sm text-gray-500">No notifications yet.</div>}
              {notifs.map((n) => (
                <div key={n.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="pill pill-info">{n.notif_type}</span>
                  </div>
                  <div className="font-semibold text-sm text-gray-900">{n.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{n.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-gray-900">Upcoming visits</h3>
              <Calendar size={16} className="text-gray-400" />
            </div>
            <div className="divide-y divide-gray-100">
              {visits.length === 0 && <div className="p-6 text-sm text-gray-500">No upcoming visits.</div>}
              {visits.map((v) => (
                <div key={v.id} className="p-4">
                  <div className="font-semibold text-sm text-gray-900">{v.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {v.date} · {v.time} · {v.location}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ to, icon: Icon, label, testId }) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#0A1128] transition-colors group"
    >
      <Icon size={22} className="text-[#0A1128]" />
      <div className="mt-3 font-heading font-semibold text-gray-900 group-hover:underline">{label}</div>
    </Link>
  );
}
