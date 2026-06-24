import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Calendar, MapPin } from "lucide-react";
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
  const canCreate = ["pa", "politician", "admin"].includes(user?.role);

  const load = () => api.get("/visits", { params: { upcoming: user?.role === "citizen" } }).then((r) => setItems(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Politician visits, camps and public meetings">Visits & Camps</SectionTitle>

      {canCreate && <Composer onCreated={load} />}

      {items.length === 0 ? (
        <EmptyState title="No visits scheduled" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((v) => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2">
                <span className="pill pill-info">{v.visit_type}</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ onCreated }) {
  const [form, setForm] = useState({
    title: "", description: "", date: "", time: "", location: "", visit_type: "Janata Darbar", target_audience: "",
  });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.title || !form.date || !form.time || !form.location) return toast.error("Fill required fields");
    try {
      await api.post("/visits", form);
      toast.success("Visit scheduled and notified");
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
      <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} data-testid="visit-submit">Schedule & Notify</Button>
    </div>
  );
}

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
