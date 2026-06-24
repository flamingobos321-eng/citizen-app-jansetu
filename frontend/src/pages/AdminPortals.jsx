import { useEffect, useState } from "react";
import { api, fileUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Globe, Pencil, Trash2, Star, X, ExternalLink, Upload } from "lucide-react";

const empty = {
  slug: "",
  is_active: true,
  is_default: false,
  politician_name: "",
  designation: "",
  constituency_name: "",
  welcome_message: "",
  tagline: "",
  theme_color: "#0A1128",
  accent_color: "",
  logo_path: "",
  hero_image_path: "",
  contact_phone: "",
  contact_email: "",
  contact_address: "",
  office_hours: "",
  social_links: { facebook: "", twitter: "", instagram: "", youtube: "", whatsapp: "" },
};

export default function AdminPortals() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/portals").then((r) => setList(r.data || []));
  useEffect(() => { load(); }, []);

  if (user && user.role !== "admin") {
    return <div className="p-8"><EmptyState title="Admin only" hint="You don't have access to manage portals." /></div>;
  }

  const setDefault = async (p) => {
    try {
      await api.post(`/admin/portals/${p.id}/set-default`);
      toast.success(`${p.politician_name} is now the default portal`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const deletePortal = async (p) => {
    if (!window.confirm(`Disable portal "${p.constituency_name}"? It can be re-enabled later by editing it.`)) return;
    try {
      await api.delete(`/admin/portals/${p.id}`);
      toast.success("Portal disabled");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle subtitle="White-label client portals. One portal per constituency. Same platform, different branding.">Client Portals</SectionTitle>
        <button onClick={() => setEditing({ ...empty })} data-testid="new-portal-btn" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90">
          <Plus size={16} /> New Portal
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No portals yet" hint="Create your first white-label portal to launch a constituency's public face." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {list.map((p) => (
            <div key={p.id} className="p-4 flex items-center gap-4 flex-wrap" data-testid={`portal-row-${p.slug}`}>
              <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-heading text-lg font-bold shrink-0" style={{ backgroundColor: p.theme_color || "#0A1128" }}>
                {p.logo_path ? <img src={fileUrl(p.logo_path)} alt="" className="w-full h-full object-cover rounded-md" /> : (p.politician_name || "P").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-semibold text-gray-900">{p.politician_name}</span>
                  {p.is_default && <span className="pill pill-info inline-flex items-center gap-1"><Star size={11} /> Default</span>}
                  {!p.is_active && <span className="pill pill-neutral">Inactive</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{p.designation} · {p.constituency_name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">/portal/{p.slug}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`/portal/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-open-${p.slug}`}>
                  <ExternalLink size={12} /> Open
                </a>
                {!p.is_default && p.is_active && (
                  <button onClick={() => setDefault(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-default-${p.slug}`}>
                    <Star size={12} /> Set Default
                  </button>
                )}
                <button onClick={() => setEditing({ ...empty, ...p, social_links: { ...empty.social_links, ...(p.social_links || {}) } })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-edit-${p.slug}`}>
                  <Pencil size={12} /> Edit
                </button>
                {p.is_active && (
                  <button onClick={() => deletePortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-red-200 text-red-700 hover:bg-red-50" data-testid={`portal-delete-${p.slug}`}>
                    <Trash2 size={12} /> Disable
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function EditDialog({ initial, onClose, onSaved }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [k]: v } }));

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      set("logo_path", r.data.path);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const save = async () => {
    // Diagnostic-friendly validation: name the missing field(s) and focus the first.
    const required = [
      { key: "slug",               label: "Slug",            testId: "portal-slug" },
      { key: "politician_name",    label: "Politician Name", testId: "portal-pname" },
      { key: "designation",        label: "Designation",     testId: "portal-designation" },
      { key: "constituency_name",  label: "Constituency",    testId: "portal-cname" },
      { key: "welcome_message",    label: "Welcome Message", testId: "portal-welcome" },
    ];
    const missing = required.filter((r) => !String(form[r.key] ?? "").trim());
    if (missing.length > 0) {
      const labels = missing.map((m) => m.label).join(", ");
      toast.error(`Missing required field${missing.length > 1 ? "s" : ""}: ${labels}`);
      try {
        const first = document.querySelector(`[data-testid="${missing[0].testId}"]`);
        if (first) {
          first.scrollIntoView({ behavior: "smooth", block: "center" });
          first.focus();
        }
      } catch (e) { /* ignore */ }
      return;
    }
    setSaving(true);
    try {
      // Clean empty social link values
      const social = Object.fromEntries(Object.entries(form.social_links || {}).filter(([_, v]) => (v || "").trim()));
      // Trim required fields in the outgoing payload (defensive)
      const trimmed = Object.fromEntries(required.map((r) => [r.key, String(form[r.key] ?? "").trim()]));
      const payload = { ...form, ...trimmed, social_links: social };
      if (isNew) {
        await api.post("/admin/portals", payload);
        toast.success("Portal created");
      } else {
        await api.put(`/admin/portals/${form.id}`, payload);
        toast.success("Portal updated");
      }
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()} data-testid="portal-edit-dialog">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-heading text-xl font-bold text-gray-900 flex items-center gap-2"><Globe size={18} /> {isNew ? "New Portal" : "Edit Portal"}</h3>
            <div className="text-xs text-gray-500 mt-0.5">All fields below control the white-label branding for this constituency.</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Slug (URL)" required hint="e.g. pune-cantonment">
            <Input data-testid="portal-slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="pune-cantonment" />
          </F>
          <F label="Constituency Name" required>
            <Input data-testid="portal-cname" value={form.constituency_name} onChange={(e) => set("constituency_name", e.target.value)} placeholder="Pune Cantonment" />
          </F>
          <F label="Politician Name" required>
            <Input data-testid="portal-pname" value={form.politician_name} onChange={(e) => set("politician_name", e.target.value)} placeholder="Hon. Rajesh Patil" />
          </F>
          <F label="Designation" required>
            <Input data-testid="portal-designation" value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="MLA, Pune Cantonment" />
          </F>
          <div className="sm:col-span-2">
            <F label="Welcome Message" required>
              <Textarea data-testid="portal-welcome" rows={3} value={form.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} placeholder="Welcome to our digital constituency..." />
            </F>
          </div>
          <F label="Tagline (optional)">
            <Input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Sewa. Suvidha. Sashaktikaran." />
          </F>
          <F label="Theme Color">
            <div className="flex items-center gap-2">
              <input type="color" data-testid="portal-color" value={form.theme_color || "#0A1128"} onChange={(e) => set("theme_color", e.target.value)} className="h-9 w-12 rounded border border-gray-200" />
              <Input value={form.theme_color || ""} onChange={(e) => set("theme_color", e.target.value)} placeholder="#0A1128" />
            </div>
          </F>

          <div className="sm:col-span-2">
            <F label="Logo">
              <div className="flex items-center gap-3">
                {form.logo_path ? (
                  <img src={fileUrl(form.logo_path)} alt="" className="w-14 h-14 rounded-md object-cover border border-gray-200" />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No logo</div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <Upload size={12} /> {logoUploading ? "Uploading…" : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} data-testid="portal-logo-upload" />
                </label>
                {form.logo_path && <button onClick={() => set("logo_path", "")} className="text-xs text-red-600 hover:underline">Remove</button>}
              </div>
            </F>
          </div>

          <F label="Contact Phone">
            <Input value={form.contact_phone || ""} onChange={(e) => set("contact_phone", e.target.value)} placeholder="+91 ..." />
          </F>
          <F label="Contact Email">
            <Input value={form.contact_email || ""} onChange={(e) => set("contact_email", e.target.value)} placeholder="office@..." />
          </F>
          <div className="sm:col-span-2">
            <F label="Office Address">
              <Textarea rows={2} value={form.contact_address || ""} onChange={(e) => set("contact_address", e.target.value)} />
            </F>
          </div>
          <F label="Office Hours">
            <Input value={form.office_hours || ""} onChange={(e) => set("office_hours", e.target.value)} placeholder="Mon - Sat, 10:00 AM to 6:00 PM" />
          </F>
          <F label="Status">
            <div className="flex items-center gap-3 h-9">
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!form.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active</label>
              <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!form.is_default} onChange={(e) => set("is_default", e.target.checked)} /> Default</label>
            </div>
          </F>

          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-gray-500">Social Links (optional)</Label>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <Input value={form.social_links?.facebook || ""} onChange={(e) => setSocial("facebook", e.target.value)} placeholder="Facebook URL" />
              <Input value={form.social_links?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} placeholder="Twitter URL" />
              <Input value={form.social_links?.instagram || ""} onChange={(e) => setSocial("instagram", e.target.value)} placeholder="Instagram URL" />
              <Input value={form.social_links?.youtube || ""} onChange={(e) => setSocial("youtube", e.target.value)} placeholder="YouTube URL" />
              <Input value={form.social_links?.whatsapp || ""} onChange={(e) => setSocial("whatsapp", e.target.value)} placeholder="WhatsApp link (https://wa.me/...)" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} data-testid="portal-save" className="px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : (isNew ? "Create Portal" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

const F = ({ label, required, hint, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider font-bold text-gray-600 mb-1.5 block">
      {label} {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
    {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
  </div>
);
