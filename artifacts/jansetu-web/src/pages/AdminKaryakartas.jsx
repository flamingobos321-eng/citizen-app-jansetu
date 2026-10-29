import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { Users, Plus, Upload, Trash2, Cake, Heart, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const DESIGNATIONS = [
  "Booth Agent", "Ward President", "Village President", "Volunteer",
  "Field Coordinator", "Youth Wing", "Women Wing", "Other",
];

const CSV_TEMPLATE =
  "name,mobile,designation,ward,village,dob,anniversary,notes\n" +
  "Ravi Patil,9999900010,Booth Agent,,,1985-07-14,2010-06-18,Cluster A booth\n" +
  "Suresh Jadhav,9999900011,Ward President,,,,,\n";

export default function AdminKaryakartas() {
  const { user } = useAuth();
  const [data, setData] = useState({ linked: [], pending: [] });
  const [areas, setAreas] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: "", mobile: "", designation: "Booth Agent",
    ward_id: "", village_id: "", dob: "", anniversary: "", notes: "",
  });

  const load = () => {
    api.get("/karyakartas").then((r) => setData(r.data)).catch(() => setData({ linked: [], pending: [] }));
    api.get("/areas").then((r) => setAreas(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  if (user && !["pa", "politician", "admin"].includes(user.role)) {
    return <div className="p-8"><EmptyState title="Staff only" /></div>;
  }
  const canWrite = ["pa", "admin"].includes(user?.role);

  const wards = areas.filter((a) => a.kind === "ward");
  const villages = areas.filter((a) => a.kind === "village");
  const areaName = (id) => areas.find((a) => a.id === id)?.name || "";

  const submitOne = async () => {
    if (!form.name || !form.mobile) return toast.error("Name and mobile are required");
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => { if (!payload[k]) delete payload[k]; });
      const r = await api.post("/karyakartas", payload);
      toast.success(r.data.linked ? "Karyakarta linked to existing citizen." : "Pending karyakarta saved. Will auto-link when they register.");
      setAddOpen(false);
      setForm({ name: "", mobile: "", designation: "Booth Agent", ward_id: "", village_id: "", dob: "", anniversary: "", notes: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Remove this karyakarta?")) return;
    try {
      await api.delete(`/karyakartas/${id}`);
      toast.success("Removed");
      load();
    } catch { toast.error("Failed"); }
  };

  const parseCsv = (text) => {
    // Simple CSV parser (no quoted commas needed for our schema).
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 1) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] || ""; });
      const norm = {
        name: row["name"] || "",
        mobile: (row["mobile"] || row["mobile number"] || "").replace(/\D/g, ""),
        designation: row["designation"] || row["role"] || undefined,
        ward_id: row["ward_id"] || undefined,
        village_id: row["village_id"] || undefined,
        dob: row["dob"] || row["date of birth"] || undefined,
        anniversary: row["anniversary"] || row["marriage anniversary"] || undefined,
        notes: row["notes"] || undefined,
      };
      // If ward/village passed as name, resolve.
      const wardName = row["ward"];
      const villageName = row["village"];
      if (!norm.ward_id && wardName) {
        const w = wards.find((x) => x.name.toLowerCase() === wardName.toLowerCase());
        if (w) norm.ward_id = w.id;
      }
      if (!norm.village_id && villageName) {
        const v = villages.find((x) => x.name.toLowerCase() === villageName.toLowerCase());
        if (v) norm.village_id = v.id;
      }
      Object.keys(norm).forEach((k) => { if (!norm[k]) delete norm[k]; });
      return norm;
    }).filter((r) => r.name && r.mobile);
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const rows = parseCsv(text);
    setImportPreview(rows);
    setImportResult(null);
  };

  const runImport = async () => {
    if (importPreview.length === 0) return toast.error("Nothing to import");
    try {
      const r = await api.post("/karyakartas/bulk-import", importPreview);
      setImportResult(r.data);
      toast.success(`Imported: ${r.data.linked} linked, ${r.data.pending} pending${r.data.errors?.length ? `, ${r.data.errors.length} errors` : ""}`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "karyakarta_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle
        subtitle="Party workers and volunteers — track designations, birthdays, anniversaries."
        action={
          canWrite && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="karyakarta-import-btn">
                <Upload size={14} className="mr-2" /> Bulk Import CSV
              </Button>
              <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={() => setAddOpen(true)} data-testid="karyakarta-add-btn">
                <Plus size={14} className="mr-2" /> Add Karyakarta
              </Button>
            </div>
          )
        }
      >
        Karyakartas
      </SectionTitle>

      {/* Linked */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#10B981]" />
          <h3 className="font-heading font-semibold text-gray-900">Linked karyakartas ({data.linked?.length || 0})</h3>
        </div>
        {(!data.linked || data.linked.length === 0) ? (
          <div className="p-6 text-sm text-gray-500">No linked karyakartas yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.linked.map((k) => (
              <div key={k.id} className="p-4 flex items-center gap-3 flex-wrap" data-testid={`karyakarta-row-${k.id}`}>
                <div className="w-10 h-10 rounded-full bg-[#0A1128] text-white flex items-center justify-center font-bold shrink-0">
                  {k.name?.charAt(0)?.toUpperCase() || "K"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">{k.name}</div>
                  <div className="text-xs text-gray-500">
                    {k.mobile} · {k.designation || "—"}
                    {k.ward_id && ` · Ward: ${areaName(k.ward_id)}`}
                    {k.village_id && ` · Village: ${areaName(k.village_id)}`}
                  </div>
                  <div className="flex gap-3 mt-1 flex-wrap text-[11px] text-gray-500">
                    {k.dob && <span className="flex items-center gap-1"><Cake size={11} /> {k.dob}</span>}
                    {k.anniversary && <span className="flex items-center gap-1"><Heart size={11} /> {k.anniversary}</span>}
                  </div>
                </div>
                {canWrite && (
                  <Button size="sm" variant="ghost" onClick={() => del(k.id)} data-testid={`karyakarta-del-${k.id}`}>
                    <Trash2 size={14} className="text-red-600" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Clock size={16} className="text-amber-600" />
          <h3 className="font-heading font-semibold text-gray-900">Pending karyakartas ({data.pending?.length || 0})</h3>
          <span className="text-xs text-gray-500">Auto-link when they register</span>
        </div>
        {(!data.pending || data.pending.length === 0) ? (
          <div className="p-6 text-sm text-gray-500">No pending karyakartas.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.pending.map((k) => (
              <div key={k.id} className="p-4 flex items-center gap-3 flex-wrap" data-testid={`karyakarta-pending-${k.id}`}>
                <Users size={18} className="text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">{k.name}</div>
                  <div className="text-xs text-gray-500">{k.mobile} · {k.designation || "—"}</div>
                </div>
                {canWrite && (
                  <Button size="sm" variant="ghost" onClick={() => del(k.id)} data-testid={`karyakarta-pending-del-${k.id}`}>
                    <Trash2 size={14} className="text-red-600" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="karyakarta-add-dialog">
          <DialogHeader>
            <DialogTitle>Add karyakarta</DialogTitle>
            <DialogDescription>If the mobile is already registered here, the citizen becomes a karyakarta immediately. Otherwise, we hold it as pending.</DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <F label="Name *"><Input data-testid="ka-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></F>
            <F label="Mobile *"><Input data-testid="ka-mobile" inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))} /></F>
            <F label="Designation">
              <Select value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v }))}>
                <SelectTrigger data-testid="ka-designation"><SelectValue /></SelectTrigger>
                <SelectContent>{DESIGNATIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Ward">
              <Select value={form.ward_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, ward_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger data-testid="ka-ward"><SelectValue placeholder="Select ward" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Village">
              <Select value={form.village_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, village_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger data-testid="ka-village"><SelectValue placeholder="Select village" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {villages.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Date of Birth"><Input type="date" data-testid="ka-dob" value={form.dob} onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))} /></F>
            <F label="Anniversary"><Input type="date" data-testid="ka-ann" value={form.anniversary} onChange={(e) => setForm((f) => ({ ...f, anniversary: e.target.value }))} /></F>
            <div className="sm:col-span-2"><F label="Notes"><Input data-testid="ka-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></F></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submitOne} data-testid="ka-save">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportPreview([]); setImportResult(null); } }}>
        <DialogContent className="sm:max-w-2xl" data-testid="karyakarta-import-dialog">
          <DialogHeader>
            <DialogTitle>Bulk import karyakartas</DialogTitle>
            <DialogDescription>
              Upload CSV with columns: <span className="font-mono text-[11px]">name, mobile, designation, ward, village, dob, anniversary, notes</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="karyakarta-template-btn">Download template</Button>
              <Input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} data-testid="karyakarta-file-input" className="max-w-xs" />
            </div>
            {importPreview.length > 0 && (
              <div className="border border-gray-200 rounded-md max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Mobile</th>
                      <th className="text-left p-2">Designation</th>
                      <th className="text-left p-2">DOB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100" data-testid={`import-preview-row-${i}`}>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.mobile}</td>
                        <td className="p-2">{r.designation || "—"}</td>
                        <td className="p-2">{r.dob || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {importResult && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200 text-xs text-green-900" data-testid="karyakarta-import-result">
                Linked: <b>{importResult.linked}</b> · Pending: <b>{importResult.pending}</b> · Errors: <b>{importResult.errors?.length || 0}</b>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-red-700">
                    {importResult.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e.row?.name || e.row?.mobile}: {typeof e.error === "string" ? e.error : JSON.stringify(e.error)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button
              className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              disabled={importPreview.length === 0}
              onClick={runImport}
              data-testid="karyakarta-import-run"
            >
              Import {importPreview.length > 0 ? `(${importPreview.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
