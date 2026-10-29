import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Search, Loader2, CheckCircle2, AlertTriangle,
  User as UserIcon, Home, IdCard, Save, X, Filter,
} from "lucide-react";

// Manual Review Queue — Office Admin fixes partial/failed voter records.
//
// Rules (per PRD, do NOT modify without approval):
//   • Every voter is imported (never skipped).
//   • Records missing critical identity (name/age/gender) → "failed"
//     bucket. They are NOT searchable by citizens.
//   • Records missing non-critical fields (EPIC / house / relative name)
//     → "partial" bucket. Citizens CAN still find & claim them.
//   • Admin edits are tagged as ``manually_corrected_fields`` so future
//     re-imports never overwrite them.
export default function AdminElectoralReview() {
  const [tab, setTab] = useState("partial");    // "partial" | "failed"
  const [missing, setMissing] = useState("");   // "" | "epic" | "house" | "relative_name" | "name" | "age" | "gender"
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ partial: 0, failed: 0, complete: 0 });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      if (missing) params.set("missing", missing);
      if (q.trim()) params.set("q", q.trim());
      const r = await api.get(`/admin/electoral-roll/review?${params.toString()}`);
      setRows(r.data.records || []);
      setCounts(r.data.counts || counts);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab, missing]);

  const openEdit = (row) => {
    setEditing(row);
    setDraft({
      name: row.name || "",
      age: row.age || "",
      gender: row.gender || "",
      epic_number: row.epic_number || "",
      house_number: row.house_number || "",
      relative_name: row.relative_name || "",
      relation_type: row.relation_type || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const patch = {};
      Object.entries(draft).forEach(([k, v]) => {
        if (v === "" || v === null || v === undefined) return;
        if (v === editing[k]) return;   // skip unchanged
        if (k === "age") patch[k] = parseInt(v, 10);
        else patch[k] = v;
      });
      if (Object.keys(patch).length === 0) {
        toast.error("Nothing to save");
        setSaving(false);
        return;
      }
      const r = await api.patch(`/admin/electoral-roll/review/${editing.id}`, patch);
      toast.success(`Saved — record is now ${r.data.updated.import_status}`);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const filterOptions = useMemo(() => (tab === "partial"
    ? [
      { value: "", label: "All partial" },
      { value: "epic", label: "Missing EPIC" },
      { value: "house", label: "Missing House" },
      { value: "relative_name", label: "Missing Relative" },
    ]
    : [
      { value: "", label: "All failed" },
      { value: "name", label: "Missing Name" },
      { value: "age", label: "Missing Age" },
      { value: "gender", label: "Missing Gender" },
    ]
  ), [tab]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="admin-electoral-review">
      <header className="flex items-center justify-between">
        <div>
          <Link to="/app/electoral-roll" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 mb-1">
            <ArrowLeft size={14} /> Back to Electoral Roll
          </Link>
          <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight">Manual Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Voters whose electoral roll data was partially or fully unreadable. Every edit is preserved
            across future re-imports.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="review-refresh">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </header>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Complete" value={counts.complete} tone="green" testId="count-complete" />
        <CountCard label="Partial (searchable)" value={counts.partial} tone="amber" testId="count-partial" />
        <CountCard label="Failed (not searchable)" value={counts.failed} tone="red" testId="count-failed" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <TabButton active={tab === "partial"} onClick={() => { setTab("partial"); setMissing(""); }} testId="tab-partial">
          Partial ({counts.partial})
        </TabButton>
        <TabButton active={tab === "failed"} onClick={() => { setTab("failed"); setMissing(""); }} testId="tab-failed">
          Failed ({counts.failed})
        </TabButton>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {filterOptions.map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setMissing(opt.value)}
              data-testid={`filter-${opt.value || "all"}`}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                missing === opt.value
                  ? "bg-[#0A1128] text-white border-[#0A1128]"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <Input
              placeholder="Search name or relative"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              className="pl-9"
              data-testid="review-search"
            />
          </div>
        </div>
        <Button variant="outline" onClick={load} data-testid="review-search-btn">Search</Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-[11px] uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Relative</th>
                <th className="px-4 py-3">Age / Gender</th>
                <th className="px-4 py-3">EPIC</th>
                <th className="px-4 py-3">House</th>
                <th className="px-4 py-3">Part / Sr</th>
                <th className="px-4 py-3">Missing</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500" data-testid="review-empty">
                    Nothing to review here. Nice work!
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`review-row-${r.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name || <span className="text-red-600">— missing —</span>}</div>
                    {r.manually_corrected_fields?.length > 0 && (
                      <div className="text-[10px] text-blue-600 uppercase tracking-widest mt-0.5">
                        edited: {r.manually_corrected_fields.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.relative_name
                      ? <>{r.relative_name} <span className="text-[10px] text-gray-500 uppercase">({r.relation_type})</span></>
                      : <span className="text-red-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.age ?? <span className="text-red-600">—</span>} / {r.gender ?? <span className="text-red-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono">
                    {r.epic_number || <span className="text-red-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.house_number || <span className="text-red-600">—</span>}</td>
                  <td className="px-4 py-3 text-xs">{r.part_number}/{r.serial_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(r.import_missing_fields || []).map((f) => (
                        <span key={f} className="text-[10px] uppercase tracking-widest bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} data-testid={`review-edit-${r.id}`}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg bg-white rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()} data-testid="review-edit-modal">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-gray-900">Edit voter record</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manually-corrected fields are preserved across future re-imports.
                </p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-500" data-testid="review-close-modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <EditField label="Full Name *" required
                value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
                icon={UserIcon} testId="edit-name" />
              <EditField label="Age *" type="number"
                value={draft.age} onChange={(v) => setDraft((d) => ({ ...d, age: v }))}
                testId="edit-age" />
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Gender *</Label>
                <select
                  value={draft.gender}
                  onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                  data-testid="edit-gender"
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white"
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <EditField label="EPIC Number" icon={IdCard}
                value={draft.epic_number}
                onChange={(v) => setDraft((d) => ({ ...d, epic_number: v.toUpperCase() }))}
                testId="edit-epic" />
              <EditField label="House Number" icon={Home}
                value={draft.house_number} onChange={(v) => setDraft((d) => ({ ...d, house_number: v }))}
                testId="edit-house" />
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Relation</Label>
                <select
                  value={draft.relation_type}
                  onChange={(e) => setDraft((d) => ({ ...d, relation_type: e.target.value }))}
                  data-testid="edit-relation-type"
                  className="w-full h-10 border border-gray-300 rounded-md px-3 text-sm bg-white"
                >
                  <option value="">—</option>
                  <option value="Father">Father</option>
                  <option value="Husband">Husband</option>
                  <option value="Mother">Mother</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <EditField label="Relative Name" className="col-span-2"
                value={draft.relative_name} onChange={(v) => setDraft((d) => ({ ...d, relative_name: v }))}
                testId="edit-relative" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)} className="flex-1" data-testid="review-cancel">
                Cancel
              </Button>
              <Button onClick={save} disabled={saving} className="flex-1 bg-[#0A1128] text-white hover:opacity-90" data-testid="review-save">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CountCard({ label, value, tone, testId }) {
  const cls = tone === "green" ? "border-green-200 bg-green-50 text-green-700"
            : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-red-200 bg-red-50 text-red-700";
  const Icon = tone === "green" ? CheckCircle2 : AlertTriangle;
  return (
    <div className={`border rounded-lg p-4 ${cls}`} data-testid={testId}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <div className="text-[11px] uppercase tracking-widest font-bold">{label}</div>
      </div>
      <div className="text-3xl font-heading font-bold mt-1">{value ?? 0}</div>
    </div>
  );
}

function TabButton({ active, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`px-4 py-2 text-sm font-heading font-semibold border-b-2 -mb-px ${
        active ? "border-[#0A1128] text-[#0A1128]" : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function EditField({ label, value, onChange, icon: Icon, type = "text", className = "", testId, required }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">
        {label}
      </Label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />}
        <Input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={Icon ? "pl-9" : ""}
          data-testid={testId}
        />
      </div>
    </div>
  );
}
