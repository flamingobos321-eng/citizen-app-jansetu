import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, fileUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Plus, Globe, Pencil, Trash2, Star, X, ExternalLink, Upload, Pause, Play, Timer, CreditCard, Copy, CheckCircle2, KeyRound, Archive, RotateCcw, AlertTriangle } from "lucide-react";

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
  primary_admin_email: "",
  primary_admin_name: "",
  // OTP / communication (per-tenant, defaults to dev-safe).
  communication_mode: "development",
  otp_config: { provider: "fast2sms", api_key: "", sender_id: "", message_id: "", route: "dlt" },
};

export default function AdminPortals() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [provisioned, setProvisioned] = useState(null); // { portal, credentials, urls }
  const [includeArchived, setIncludeArchived] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState(null); // portal being purged
  const [purgeForm, setPurgeForm] = useState({ slug: "", text: "" });

  const load = () => api.get("/admin/portals", { params: { include_archived: includeArchived } }).then((r) => setList(r.data || []));
  useEffect(() => { load(); }, [includeArchived]);

  if (user && user.role !== "admin" && user.role !== "super_admin") {
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
  const suspendPortal = async (p) => {
    if (!window.confirm(`Suspend portal "${p.constituency_name}"? Citizens won't be able to access it until reactivated.`)) return;
    try {
      await api.post(`/admin/portals/${p.id}/suspend`);
      toast.success("Portal suspended");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const activatePortal = async (p) => {
    try {
      await api.post(`/admin/portals/${p.id}/activate`);
      toast.success("Portal activated");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const deletePortal = async (p) => {
    // Legacy button removed. New flow uses archive -> permanent-delete.
    setPurgeTarget(p);
    setPurgeForm({ slug: "", text: "" });
  };
  const archivePortal = async (p) => {
    if (!window.confirm(`Archive portal "${p.constituency_name}"? It will be hidden from public and admin lists, but can be restored anytime.`)) return;
    try {
      await api.post(`/admin/portals/${p.id}/archive`);
      toast.success("Portal archived");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const restorePortal = async (p) => {
    try {
      await api.post(`/admin/portals/${p.id}/restore`);
      toast.success("Portal restored");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const purgePortal = async () => {
    if (!purgeTarget) return;
    try {
      const r = await api.delete(`/admin/portals/${purgeTarget.id}`, {
        data: { confirm_slug: purgeForm.slug, confirm_text: purgeForm.text },
      });
      const counts = r.data?.counts || {};
      const total = Object.values(counts).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);
      toast.success(`Purged "${purgeTarget.constituency_name}" — ${total} rows deleted across ${Object.keys(counts).length} collections.`);
      setPurgeTarget(null);
      setPurgeForm({ slug: "", text: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  const resetAdminPassword = async (p) => {
    if (!window.confirm(`Reset the tenant admin password for "${p.constituency_name}"? The current password will stop working immediately.`)) return;
    try {
      const r = await api.post(`/admin/portals/${p.id}/reset-admin-password`);
      setProvisioned({
        portal: p,
        credentials: { tenant_admin_email: r.data.tenant_admin_email, temp_password: r.data.temp_password, must_change_password: true },
        urls: { portal_url: `/portal/${p.slug}`, staff_login_url: `/staff/login?portal=${p.slug}`, citizen_portal_url: `/portal/${p.slug}` },
        title: "Password Reset",
        intro: "A new temporary password has been generated. Share it securely with the tenant admin — it will not be shown again.",
      });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionTitle subtitle="White-label client portals. One portal per constituency. Same platform, different branding.">Client Portals</SectionTitle>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer select-none" data-testid="toggle-archived">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} className="rounded" />
            Show archived
          </label>
          <button onClick={() => setEditing({ ...empty })} data-testid="new-portal-btn" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90">
            <Plus size={16} /> New Portal
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No portals yet" hint="Create your first white-label portal to launch a constituency's public face." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {list.map((p) => {
            const isSuspended = p.portal_status === "suspended";
            const isArchived = p.portal_status === "archived";
            return (
            <div key={p.id} className={`p-4 flex items-center gap-4 flex-wrap ${isArchived ? "bg-gray-50 opacity-75" : ""}`} data-testid={`portal-row-${p.slug}`}>
              <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-heading text-lg font-bold shrink-0" style={{ backgroundColor: p.theme_color || "#0A1128" }}>
                {p.logo_path ? <img src={fileUrl(p.logo_path)} alt="" className="w-full h-full object-cover rounded-md" /> : (p.politician_name || "P").charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-semibold text-gray-900">{p.politician_name}</span>
                  {p.is_default && <span className="pill pill-info inline-flex items-center gap-1"><Star size={11} /> Default</span>}
                  {isArchived ? (
                    <span className="pill pill-neutral inline-flex items-center gap-1"><Archive size={11} /> Archived</span>
                  ) : !p.is_active ? (
                    <span className="pill pill-neutral">Inactive</span>
                  ) : isSuspended ? (
                    <span className="pill pill-overdue">Suspended</span>
                  ) : (
                    <span className="pill pill-resolved">Active</span>
                  )}
                  {p.is_trial && <span className="pill pill-warn inline-flex items-center gap-1"><Timer size={11} /> Trial</span>}
                  {p.subscription_plan && p.subscription_plan !== "trial" && (
                    <span className="pill pill-info inline-flex items-center gap-1"><CreditCard size={11} /> {p.subscription_plan}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{p.designation} · {p.constituency_name}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">/portal/{p.slug} {p.primary_admin_email && <>· Admin: {p.primary_admin_email}</>}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isArchived && (
                  <a href={`/portal/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-open-${p.slug}`}>
                    <ExternalLink size={12} /> Open
                  </a>
                )}
                {!p.is_default && p.is_active && !isArchived && (
                  <button onClick={() => setDefault(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-default-${p.slug}`}>
                    <Star size={12} /> Set Default
                  </button>
                )}
                {p.is_active && !isSuspended && !isArchived && (
                  <button onClick={() => suspendPortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-amber-200 text-amber-800 hover:bg-amber-50" data-testid={`portal-suspend-${p.slug}`}>
                    <Pause size={12} /> Suspend
                  </button>
                )}
                {isSuspended && !isArchived && (
                  <button onClick={() => activatePortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-green-200 text-green-800 hover:bg-green-50" data-testid={`portal-activate-${p.slug}`}>
                    <Play size={12} /> Activate
                  </button>
                )}
                {!isArchived && (
                  <button onClick={() => setEditing({ ...empty, ...p, social_links: { ...empty.social_links, ...(p.social_links || {}) } })} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`portal-edit-${p.slug}`}>
                    <Pencil size={12} /> Edit
                  </button>
                )}
                {p.is_active && !isArchived && (
                  <button onClick={() => resetAdminPassword(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50" data-testid={`portal-reset-pwd-${p.slug}`}>
                    <KeyRound size={12} /> Reset Admin
                  </button>
                )}
                {!isArchived && (
                  <button onClick={() => archivePortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50" data-testid={`portal-archive-${p.slug}`}>
                    <Archive size={12} /> Archive
                  </button>
                )}
                {isArchived && (
                  <>
                    <button onClick={() => restorePortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-green-200 text-green-800 hover:bg-green-50" data-testid={`portal-restore-${p.slug}`}>
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button onClick={() => deletePortal(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-red-300 text-red-700 hover:bg-red-50" data-testid={`portal-delete-${p.slug}`}>
                      <Trash2 size={12} /> Delete Permanently
                    </button>
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            load();
            if (result && result.credentials) {
              setProvisioned({ ...result, title: "Portal Created", intro: "Your client portal is live. Share these credentials securely — the temporary password will not be shown again." });
            }
          }}
        />
      )}
      {provisioned && (
        <ProvisionedDialog data={provisioned} onClose={() => setProvisioned(null)} />
      )}
      {purgeTarget && (
        <PurgeDialog
          portal={purgeTarget}
          form={purgeForm}
          setForm={setPurgeForm}
          onCancel={() => { setPurgeTarget(null); setPurgeForm({ slug: "", text: "" }); }}
          onConfirm={purgePortal}
        />
      )}
    </div>
  );
}

function PurgeDialog({ portal, form, setForm, onCancel, onConfirm }) {
  const canDelete = form.slug === portal.slug && form.text === "DELETE PERMANENTLY";
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="portal-purge-dialog">
        <div className="p-5 border-b border-gray-200 flex items-center gap-3 bg-red-50">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <div>
            <div className="font-heading font-semibold text-gray-900">Delete portal permanently</div>
            <div className="text-xs text-gray-600 mt-0.5">"{portal.constituency_name}" — this cannot be undone.</div>
          </div>
        </div>
        <div className="p-5 space-y-4 text-sm text-gray-700">
          <p>All tenant data for this portal will be irreversibly deleted:</p>
          <ul className="list-disc pl-5 text-xs text-gray-600 space-y-0.5">
            <li>All staff and citizen accounts, households, wards/villages</li>
            <li>All issues, feedback, visits, dev-works, notifications</li>
            <li>All karyakartas, caste/religion taxonomy, family invitations</li>
            <li>All uploaded files, leads, staff invitations, subscription record</li>
          </ul>
          <p className="text-xs text-gray-500">
            Global Person records (V2) are preserved — their membership in this constituency is archived, so their cross-tenant history stays intact.
          </p>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Type the portal slug to confirm: <span className="font-mono text-red-700">{portal.slug}</span>
            </Label>
            <Input
              data-testid="purge-slug-input"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder={portal.slug}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
              Type <span className="font-mono text-red-700">DELETE PERMANENTLY</span> to enable the button
            </Label>
            <Input
              data-testid="purge-text-input"
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="DELETE PERMANENTLY"
            />
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 hover:bg-white"
            data-testid="purge-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md text-white ${canDelete ? "bg-red-600 hover:bg-red-700" : "bg-red-300 cursor-not-allowed"}`}
            data-testid="purge-confirm"
          >
            <Trash2 size={14} /> Delete permanently
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EditDialog({ initial, onClose, onSaved }) {
  const isNew = !initial.id;
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setSocial = (k, v) => setForm((f) => ({ ...f, social_links: { ...f.social_links, [k]: v } }));
  const setOtp = (k, v) => setForm((f) => ({ ...f, otp_config: { ...(f.otp_config || {}), [k]: v } }));

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post("/files/upload", fd);
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
        const r = await api.post("/admin/portals", payload);
        toast.success("Portal created");
        onSaved(r.data);
      } else {
        await api.put(`/admin/portals/${form.id}`, payload);
        toast.success("Portal updated");
        onSaved(null);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="portal-edit-dialog">
        {/* Sticky header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-heading text-xl font-bold text-gray-900 flex items-center gap-2"><Globe size={18} /> {isNew ? "New Portal" : "Edit Portal"}</h3>
            <div className="text-xs text-gray-500 mt-0.5">All fields below control the white-label branding for this constituency.</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        {/* Scrollable body — min-h-0 is required so flexbox lets this child shrink and scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
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

          {isNew && (
            <div className="sm:col-span-2">
              <Label className="text-xs uppercase tracking-wider font-bold text-gray-500">Tenant Admin (auto-provisioned on create)</Label>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <Input
                  data-testid="portal-admin-email"
                  value={form.primary_admin_email || ""}
                  onChange={(e) => set("primary_admin_email", e.target.value)}
                  placeholder={`admin@${form.slug || "<slug>"}.jansetu.in`}
                />
                <Input
                  data-testid="portal-admin-name"
                  value={form.primary_admin_name || ""}
                  onChange={(e) => set("primary_admin_name", e.target.value)}
                  placeholder={`Admin - ${form.constituency_name || "<constituency>"}`}
                />
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Leave blank to auto-generate. A temporary password will be displayed once after creation.
              </div>
            </div>
          )}

          <div className="sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider font-bold text-gray-500">Communication (OTP)</Label>
            <div className="mt-2 border border-gray-200 rounded-md p-3 space-y-3 bg-gray-50">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="comm-mode"
                    checked={(form.communication_mode || "development") === "development"}
                    onChange={() => set("communication_mode", "development")}
                    data-testid="comm-mode-dev"
                  />
                  <span>Development</span>
                  <span className="pill pill-neutral">Fixed OTP 123456</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="comm-mode"
                    checked={form.communication_mode === "production"}
                    onChange={() => set("communication_mode", "production")}
                    data-testid="comm-mode-prod"
                  />
                  <span>Production</span>
                  <span className="pill pill-info">Fast2SMS (DLT)</span>
                </label>
              </div>
              {form.communication_mode === "production" && (
                <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Provider</Label>
                    <Input value="fast2sms" disabled data-testid="otp-provider" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">Route</Label>
                    <Input
                      value={form.otp_config?.route || "dlt"}
                      onChange={(e) => setOtp("route", e.target.value)}
                      data-testid="otp-route"
                      placeholder="dlt"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                      Fast2SMS API Key <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="password"
                      value={form.otp_config?.api_key || ""}
                      onChange={(e) => setOtp("api_key", e.target.value)}
                      data-testid="otp-api-key"
                      placeholder="paste tenant API key — stored per-portal, never shared"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                      Sender ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.otp_config?.sender_id || ""}
                      onChange={(e) => setOtp("sender_id", e.target.value)}
                      data-testid="otp-sender-id"
                      placeholder="ABCMLA"
                      maxLength={6}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500">
                      DLT Message / Template ID <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={form.otp_config?.message_id || ""}
                      onChange={(e) => setOtp("message_id", e.target.value)}
                      data-testid="otp-message-id"
                      placeholder="17071xxxxxxx"
                    />
                  </div>
                </div>
              )}
              <div className="text-[11px] text-gray-500">
                Each portal has independent OTP credentials. Nothing is shared across tenants.
                {form.communication_mode !== "production" && " Toggle to Production only after DLT approval + Sender ID whitelisting."}
              </div>
            </div>
          </div>

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
        </div>

        {/* Sticky footer */}
        <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-gray-100 shrink-0 bg-white rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} data-testid="portal-save" className="px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : (isNew ? "Create Portal" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>,
    document.body
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

function ProvisionedDialog({ data, onClose }) {
  const { portal, credentials, urls, title, intro } = data;
  const [copied, setCopied] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullPortal = `${origin}${urls?.portal_url || ""}`;
  const fullStaff = `${origin}${urls?.staff_login_url || ""}`;
  const copy = (key, text) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied");
      setTimeout(() => setCopied(""), 1500);
    } catch (e) {
      toast.error("Copy failed");
    }
  };
  const copyAll = () => {
    const block = [
      `Portal: ${portal?.constituency_name || portal?.politician_name || ""}`,
      `Admin email: ${credentials?.tenant_admin_email || ""}`,
      `Temporary password: ${credentials?.temp_password || ""}`,
      `Staff login URL: ${fullStaff}`,
      `Citizen portal URL: ${fullPortal}`,
      ``,
      `Note: The admin must change this temporary password on first login.`,
    ].join("\n");
    copy("all", block);
  };
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="portal-provisioned-dialog">
        <div className="flex items-start justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md bg-green-100 text-green-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-lg font-bold text-gray-900">{title || "Portal Created"}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{intro}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 shrink-0" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          <CredRow label="Tenant" value={portal?.constituency_name || portal?.politician_name || portal?.slug} />
          <CredRow label="Admin email" value={credentials?.tenant_admin_email} onCopy={() => copy("email", credentials?.tenant_admin_email)} copied={copied === "email"} testId="prov-email" />
          <CredRow label="Temporary password" value={credentials?.temp_password} mono onCopy={() => copy("pwd", credentials?.temp_password)} copied={copied === "pwd"} testId="prov-pwd" />
          <CredRow label="Staff login URL" value={fullStaff} onCopy={() => copy("staff", fullStaff)} copied={copied === "staff"} testId="prov-staff-url" />
          <CredRow label="Citizen portal URL" value={fullPortal} onCopy={() => copy("portal", fullPortal)} copied={copied === "portal"} testId="prov-portal-url" />

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
            <div className="font-semibold mb-1">Important</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>This temporary password is shown <span className="font-semibold">only once</span>.</li>
              <li>The admin will be required to change it on first login.</li>
              <li>If lost, use the <span className="font-semibold">Reset Admin</span> button on the portal row to issue a new one.</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-between gap-2 p-4 border-t border-gray-100 shrink-0 bg-white">
          <button onClick={copyAll} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid="prov-copy-all">
            <Copy size={12} /> {copied === "all" ? "Copied!" : "Copy all"}
          </button>
          <div className="flex gap-2">
            <a href={fullStaff} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid="prov-open-staff">
              <ExternalLink size={12} /> Open staff login
            </a>
            <button onClick={onClose} className="px-3 py-2 text-xs font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90" data-testid="prov-done">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CredRow({ label, value, mono, onCopy, copied, testId }) {
  return (
    <div className="border border-gray-200 rounded-md p-3" data-testid={testId}>
      <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className={`flex-1 min-w-0 truncate text-sm ${mono ? "font-mono" : ""} text-gray-900`}>{value || "—"}</div>
        {onCopy && value && (
          <button onClick={onCopy} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded border border-gray-200 hover:bg-gray-50 shrink-0">
            {copied ? <><CheckCircle2 size={11} className="text-green-600" /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
        )}
      </div>
    </div>
  );
}
