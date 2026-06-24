import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatCard, SectionTitle } from "../components/Common";
import { Button } from "../components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download } from "lucide-react";

const COLORS = ["#0A1128", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#14B8A6", "#F97316"];

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/areas").then((r) => setAreas(r.data));
  }, []);

  const downloadCsv = async () => {
    const r = await api.get("/reports/issues.csv", { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "issues.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!stats) return <div className="p-8 text-sm text-gray-500">Loading…</div>;

  const wardData = stats.by_ward.map((w) => {
    const a = areas.find((x) => x.id === w.ward_id);
    return { name: a?.name || "Unknown", total: w.total, resolved: w.resolved };
  });

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Constituency overview</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-1">
            {user?.role === "politician" ? "Representative dashboard" : "Office dashboard"}
          </h1>
        </div>
        <Button variant="outline" onClick={downloadCsv} data-testid="export-csv-btn">
          <Download size={14} className="mr-2" /> Export issues CSV
        </Button>
      </div>

      {/* Stats - control room grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Citizens" value={stats.total_citizens} testId="s-citizens" />
        <StatCard label="Households" value={stats.total_households} testId="s-households" />
        <StatCard label="Total Issues" value={stats.total_issues} testId="s-issues" />
        <StatCard label="Workers" value={stats.total_workers} testId="s-workers" />
        <StatCard label="Resolved" value={stats.resolved_issues} accent="text-[#10B981]" testId="s-resolved" />
        <StatCard label="Pending" value={stats.pending_issues} accent="text-[#B45309]" testId="s-pending" />
        <StatCard label="Visits" value={stats.total_visits} testId="s-visits" />
        <StatCard label="Dev Works" value={stats.total_devworks} testId="s-devworks" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <ChartCard title="Issues by category">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.by_category}>
              <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0A1128" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Issues by status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={stats.by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label>
                {stats.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ward-wise performance">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={wardData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#0A1128" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Resolution snapshot">
          <div className="grid grid-cols-2 gap-4 h-full content-center">
            <BigStat label="Resolution rate" value={`${stats.total_issues ? Math.round((stats.resolved_issues / stats.total_issues) * 100) : 0}%`} color="text-[#10B981]" />
            <BigStat label="Open issues" value={stats.pending_issues} color="text-[#B45309]" />
            <BigStat label="Avg. per household" value={stats.total_households ? (stats.total_issues / stats.total_households).toFixed(1) : "0"} color="text-[#0A1128]" />
            <BigStat label="Active workers" value={stats.total_workers} color="text-[#0A1128]" />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

const ChartCard = ({ title, children }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-5">
    <h3 className="font-heading font-semibold text-gray-900 mb-4">{title}</h3>
    {children}
  </div>
);

const BigStat = ({ label, value, color }) => (
  <div>
    <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">{label}</div>
    <div className={`font-heading text-3xl font-bold mt-1 ${color}`}>{value}</div>
  </div>
);
