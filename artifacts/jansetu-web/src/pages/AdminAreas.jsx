import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Trash2, Map } from "lucide-react";

export default function AdminAreas() {
  const [areas, setAreas] = useState([]);
  const [constituencies, setConstituencies] = useState([]);
  const [form, setForm] = useState({ name: "", kind: "ward", region_type: "urban", constituency_id: "" });

  const load = () => api.get("/areas").then((r) => setAreas(r.data));
  useEffect(() => {
    load();
    api.get("/constituencies").then((r) => {
      setConstituencies(r.data);
      if (r.data[0]) setForm((f) => ({ ...f, constituency_id: r.data[0].id }));
    });
  }, []);

  const submit = async () => {
    if (!form.name || !form.constituency_id) return toast.error("Name required");
    try {
      await api.post("/areas", form);
      toast.success("Area added");
      setForm((f) => ({ ...f, name: "" }));
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this area?")) return;
    await api.delete(`/areas/${id}`);
    load();
  };

  const grouped = areas.reduce((acc, a) => {
    (acc[a.kind] = acc[a.kind] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Manage wards, villages, areas, booths and other constituency divisions">Wards & Villages</SectionTitle>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Map size={18} className="text-[#0A1128]" />
          <h3 className="font-heading font-semibold text-gray-900">Add new area</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <F label="Name *"><Input data-testid="area-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></F>
          <F label="Kind">
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
              <SelectTrigger data-testid="area-kind"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["city", "ward", "area", "booth", "taluka", "village", "wasti"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Region">
            <Select value={form.region_type} onValueChange={(v) => setForm((f) => ({ ...f, region_type: v }))}>
              <SelectTrigger data-testid="area-region"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urban">Urban</SelectItem>
                <SelectItem value="rural">Rural</SelectItem>
              </SelectContent>
            </Select>
          </F>
          <F label="Constituency">
            <Select value={form.constituency_id} onValueChange={(v) => setForm((f) => ({ ...f, constituency_id: v }))}>
              <SelectTrigger data-testid="area-const"><SelectValue /></SelectTrigger>
              <SelectContent>
                {constituencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
        </div>
        <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} data-testid="area-submit">Add area</Button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <EmptyState title="No areas configured" />
      ) : (
        Object.entries(grouped).map(([kind, list]) => (
          <div key={kind} className="bg-white border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-heading font-semibold text-gray-900 capitalize">{kind}s ({list.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {list.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{a.region_type}</div>
                  </div>
                  <button onClick={() => del(a.id)} className="text-gray-400 hover:text-red-500" data-testid={`del-area-${a.id}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
