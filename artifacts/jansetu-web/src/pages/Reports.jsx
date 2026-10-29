import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SectionTitle, StatCard } from "../components/Common";
import { Button } from "../components/ui/button";
import { Download, FileText, Hammer, Calendar, Users, Home } from "lucide-react";
import { toast } from "sonner";

const REPORTS = [
  { key: "citizens", label: "Citizens", desc: "All registered citizens with contact & address.", icon: Users, file: "citizens.csv" },
  { key: "households", label: "Households", desc: "Family-head records, addresses and member counts.", icon: Home, file: "households.csv" },
  { key: "issues", label: "Complaints", desc: "All issues raised, status, assignee, citizen rating.", icon: FileText, file: "issues.csv" },
  { key: "devworks", label: "Development Works", desc: "Public infrastructure projects and budgets.", icon: Hammer, file: "devworks.csv" },
  { key: "visits", label: "Visits & Camps", desc: "Public meetings, health camps, ward inspections.", icon: Calendar, file: "visits.csv" },
];

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api.get("/reports/summary").then((r) => setSummary(r.data)).catch(() => setSummary(null));
  }, []);

  const download = async (file) => {
    setDownloading(file);
    try {
      // Use axios responseType=blob so the browser saves the file correctly.
      const r = await api.get(`/reports/${file}`, { responseType: "blob" });
      const blob = new Blob([r.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${file} downloaded`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up" data-testid="reports-page">
      <SectionTitle subtitle="Download CSV extracts for offline analysis or external reporting">Reports & Exports</SectionTitle>

      {summary && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard testId="report-stat-citizens" label="Citizens" value={summary.citizens} />
          <StatCard testId="report-stat-households" label="Households" value={summary.households} />
          <StatCard testId="report-stat-issues" label="Issues" value={summary.issues} />
          <StatCard testId="report-stat-resolved" label="Resolved" value={summary.issues_resolved} accent="text-[#10B981]" />
          <StatCard testId="report-stat-devworks" label="Devworks" value={summary.devworks} />
          <StatCard testId="report-stat-visits" label="Visits" value={summary.visits} />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const busy = downloading === r.file;
          return (
            <div key={r.key} className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#0A1128]/5 text-[#0A1128] flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-gray-900">{r.label}</h3>
                  <div className="text-xs text-gray-500">{r.file}</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-3 flex-1">{r.desc}</p>
              <Button
                data-testid={`report-download-${r.key}`}
                className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
                onClick={() => download(r.file)}
                disabled={busy}
              >
                <Download size={14} className="mr-2" /> {busy ? "Downloading…" : "Download CSV"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
