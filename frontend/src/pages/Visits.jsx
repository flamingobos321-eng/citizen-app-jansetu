import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState, StatusPill } from "../components/Common";
import { Calendar, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";

export default function Visits() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const canCreate = ["pa", "admin"].includes(user?.role);
  const canApprove = ["politician", "admin"].includes(user?.role);

  const load = () => api.get("/visits", { params: { upcoming: user?.role === "citizen" } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const approve = async (id) => {
    try {
      await api.post(`/visits/${id}/approve`);
      toast.success("Visit approved & published");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const visible = items.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (typeFilter !== "all" && v.visit_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Politician visits, camps and public meetings">Visits & Camps</SectionTitle>

      {canCreate && <Composer onCreated={load} isAdmin={user?.role === "admin"} />}

      {/* Filters (staff/citizen) */}
      <div className="flex flex-wrap gap-3" data-testid="visits-filters">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="visits-filter-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Pending Approval", "Published", "Cancelled", "Completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="visits-filter-type"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {["Public Meeting", "Village Visit", "Ward Inspection", "Health Camp", "Janata Darbar"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No visits scheduled" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {visible.map((v) => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pill pill-info">{v.visit_type}</span>
                <StatusPill status={v.status} />
                <span className="text-xs text-gray-500">{v.date} · {v.time}</span>
              </div>
              <h3 className="font-heading font-semibold text-gray-900 mt-3">{v.title}</h3>
              {v.description && <p className="text-sm text-gray-600 mt-1">{v.description}</p>}
              <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-3">
                <MapPin size={12} /> {v.location}
              </div>
              {v.target_audience && (
                <div className="text-xs text-gray-500 mt-1">Audience: {v.target_audience}</div>
              )}
              {canApprove && v.status === "Pending Approval" && (
                <Button className="mt-4 bg-[#10B981] hover:bg-[#10B981]/90 text-white" onClick={() => approve(v.id)} data-testid={`approve-visit-${v.id}`}>
                  <CheckCircle2 size={14} className="mr-2" /> Approve & Publish
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ onCreated, isAdmin }) {
  const [form, setForm] = useState({
    title: "", description: "", date: "", time: "", location: "", visit_type: "Janata Darbar", target_audience: "",
  });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.title || !form.date || !form.time || !form.location) return toast.error("Fill required fields");
    try {
      await api.post("/visits", form);
      toast.success(isAdmin ? "Visit published" : "Visit created — pending MLA approval");
      setForm({ title: "", description: "", date: "", time: "", location: "", visit_type: "Janata Darbar", target_audience: "" });
      onCreated();
    } catch {
      toast.error("Failed");
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">Schedule a visit</h3>
        {!isAdmin && <span className="text-xs text-gray-500">(MLA approval required before publishing)</span>}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <F label="Title *"><Input data-testid="visit-title" value={form.title} onChange={(e) => upd("title", e.target.value)} /></F>
        <F label="Type">
          <Select value={form.visit_type} onValueChange={(v) => upd("visit_type", v)}>
            <SelectTrigger data-testid="visit-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Public Meeting", "Village Visit", "Ward Inspection", "Health Camp", "Janata Darbar"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Date *"><Input type="date" data-testid="visit-date" value={form.date} onChange={(e) => upd("date", e.target.value)} /></F>
        <F label="Time *"><Input type="time" data-testid="visit-time" value={form.time} onChange={(e) => upd("time", e.target.value)} /></F>
        <F label="Location *"><Input data-testid="visit-location" value={form.location} onChange={(e) => upd("location", e.target.value)} /></F>
        <F label="Target Audience"><Input data-testid="visit-audience" value={form.target_audience} onChange={(e) => upd("target_audience", e.target.value)} /></F>
        <div className="sm:col-span-2"><F label="Description"><Textarea data-testid="visit-desc" rows={2} value={form.description} onChange={(e) => upd("description", e.target.value)} /></F></div>
      </div>
      <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} data-testid="visit-submit">
        {isAdmin ? "Schedule & Publish" : "Submit for approval"}
      </Button>
    </div>
  );
}

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
