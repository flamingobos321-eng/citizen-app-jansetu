import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusPill, SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Hammer } from "lucide-react";

const THUMB = "https://images.pexels.com/photos/37636256/pexels-photo-37636256.jpeg";

export default function DevWorks() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ dev_statuses: [] });
  const canCreate = ["pa", "politician", "admin"].includes(user?.role);

  const load = () => api.get("/devworks").then((r) => setItems(r.data));
  useEffect(() => {
    load();
    api.get("/meta/categories").then((r) => setMeta(r.data));
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.post(`/devworks/${id}/status`, null, { params: { status } });
      toast.success("Status updated");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Public infrastructure & development projects in your area">Development Works</SectionTitle>

      {canCreate && <Composer onCreated={load} />}

      {items.length === 0 ? (
        <EmptyState title="No development works yet" />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((d) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="h-32 bg-gray-100">
                <img src={THUMB} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <StatusPill status={d.status} />
                  <span className="text-xs text-gray-500">{d.category}</span>
                </div>
                <h3 className="font-heading font-semibold text-gray-900">{d.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{d.description}</p>
                <div className="text-xs text-gray-500 mt-3">{d.location}</div>
                {d.budget && <div className="text-xs text-gray-500 mt-1">Budget: ₹{Number(d.budget).toLocaleString("en-IN")}</div>}
                {canCreate && (
                  <Select value={d.status} onValueChange={(v) => updateStatus(d.id, v)}>
                    <SelectTrigger className="mt-4" data-testid={`dev-status-${d.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {meta.dev_statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", category: "Road Construction", location: "", status: "Planned", budget: "" });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.title || !form.description || !form.location) return toast.error("Fill required fields");
    try {
      await api.post("/devworks", { ...form, budget: form.budget ? parseFloat(form.budget) : null });
      toast.success("Project added");
      setForm({ title: "", description: "", category: "Road Construction", location: "", status: "Planned", budget: "" });
      onCreated();
    } catch {
      toast.error("Failed");
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Hammer size={18} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">Add development project</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <F label="Title *"><Input data-testid="dev-title" value={form.title} onChange={(e) => upd("title", e.target.value)} /></F>
        <F label="Category">
          <Select value={form.category} onValueChange={(v) => upd("category", v)}>
            <SelectTrigger data-testid="dev-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Road Construction", "Water Tank", "School Building", "Street Light Installation", "Drainage Project", "Hospital Upgrade"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Location *"><Input data-testid="dev-location" value={form.location} onChange={(e) => upd("location", e.target.value)} /></F>
        <F label="Budget (₹)"><Input type="number" data-testid="dev-budget" value={form.budget} onChange={(e) => upd("budget", e.target.value)} /></F>
        <div className="sm:col-span-2"><F label="Description *"><Textarea data-testid="dev-desc" rows={2} value={form.description} onChange={(e) => upd("description", e.target.value)} /></F></div>
      </div>
      <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} data-testid="dev-submit">Add project</Button>
    </div>
  );
}

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
