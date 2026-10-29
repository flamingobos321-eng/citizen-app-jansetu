import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS", "Other"];

export default function AdminTaxonomy() {
  const { user } = useAuth();
  if (user && !["pa", "admin"].includes(user.role)) {
    return <div className="p-8"><EmptyState title="Staff only" /></div>;
  }
  return (
    <div className="space-y-8 animate-fade-up">
      <SectionTitle subtitle="Maintain the list of castes and religions used across citizen profiles.">
        Caste &amp; Religion
      </SectionTitle>
      <div className="grid lg:grid-cols-2 gap-6">
        <TaxonomyPanel
          title="Castes"
          endpoint="castes"
          testPrefix="caste"
          showCategory
        />
        <TaxonomyPanel
          title="Religions"
          endpoint="religions"
          testPrefix="religion"
          showCategory={false}
        />
      </div>
    </div>
  );
}

function TaxonomyPanel({ title, endpoint, testPrefix, showCategory }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", code: "", category: "General" });

  const load = () => {
    api.get(`/${endpoint}`).then((r) => setItems(r.data || [])).catch(() => setItems([]));
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const add = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    try {
      const payload = { name: form.name.trim(), code: form.code || undefined };
      if (showCategory) payload.category = form.category;
      await api.post(`/${endpoint}`, payload);
      toast.success("Added");
      setForm({ name: "", code: "", category: "General" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await api.delete(`/${endpoint}/${id}`);
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg" data-testid={`${testPrefix}-panel`}>
      <div className="p-4 border-b border-gray-200 flex items-center gap-2">
        <Tags size={16} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500 ml-auto">{items.length} entries</span>
      </div>
      <div className="p-4 space-y-3 border-b border-gray-200 bg-gray-50">
        <div className={`grid gap-2 ${showCategory ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
          <Field label="Name">
            <Input
              data-testid={`${testPrefix}-name`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Code">
            <Input
              data-testid={`${testPrefix}-code`}
              placeholder="Optional"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </Field>
          {showCategory && (
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger data-testid={`${testPrefix}-category`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="flex items-end">
            <Button
              className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              onClick={add}
              data-testid={`${testPrefix}-add`}
            >
              <Plus size={14} className="mr-2" /> Add
            </Button>
          </div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-sm text-gray-500">No entries yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((it) => (
            <div key={it.id} className="p-3 flex items-center gap-3" data-testid={`${testPrefix}-row-${it.id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{it.name}</div>
                <div className="text-xs text-gray-500">
                  {it.code || "—"}{showCategory && it.category ? ` · ${it.category}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(it.id)} data-testid={`${testPrefix}-del-${it.id}`}>
                <Trash2 size={14} className="text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
