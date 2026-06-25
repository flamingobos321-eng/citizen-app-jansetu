import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Plus, ShieldCheck, Wand2 } from "lucide-react";

const ROLE_PREFIX = { worker: "worker", pa: "pa", politician: "mla", admin: "admin" };

export default function AdminStaff() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenantSlug, setTenantSlug] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "worker", designation: "", mobile: "" });

  const load = () => api.get("/users").then((r) => setUsers(r.data.filter((u) => u.role !== "citizen")));
  useEffect(() => { load(); }, []);

  // Load the admin's own portal slug for email suggestions.
  useEffect(() => {
    if (!user || user.role === "super_admin") return;
    api.get("/admin/portals").then((r) => {
      const own = (r.data || []).find((p) => p.id === user.tenant_id) || r.data?.[0];
      if (own?.slug) setTenantSlug(own.slug);
    }).catch(() => { /* ignore */ });
  }, [user]);

  const emailDomain = tenantSlug ? `${tenantSlug}.jansetu.in` : "jansetu.in";

  const nextIndexForRole = useMemo(() => {
    const prefix = ROLE_PREFIX[form.role] || form.role;
    const re = new RegExp(`^${prefix}(\\d+)@`, "i");
    let max = 0;
    for (const u of users) {
      const m = (u.email || "").match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    }
    return max + 1;
  }, [users, form.role]);

  const suggestedEmail = tenantSlug ? `${ROLE_PREFIX[form.role] || form.role}${nextIndexForRole}@${emailDomain}` : "";

  const generateEmail = () => {
    if (!tenantSlug) {
      toast.error("Tenant slug unavailable. Enter the email manually.");
      return;
    }
    setForm((f) => ({ ...f, email: suggestedEmail }));
  };

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Name, email, password required");
    const emailLower = form.email.trim().toLowerCase();
    if (emailLower === "admin@jansetu.in") {
      return toast.error("admin@jansetu.in is the platform super admin. Use a tenant-scoped email like " + (suggestedEmail || "pa1@<your-slug>.jansetu.in"));
    }
    try {
      await api.post("/admin/staff", { ...form, email: emailLower });
      toast.success("Staff added");
      setForm({ name: "", email: "", password: "", role: "worker", designation: "", mobile: "" });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Manage workers, PA, politicians and admins">Staff & Roles</SectionTitle>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={18} className="text-[#0A1128]" />
          <h3 className="font-heading font-semibold text-gray-900">Add staff member</h3>
        </div>
        {/* autoComplete="off" on the form is essential — browsers love to autofill
            the email field with the currently logged-in admin's address. */}
        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <F label="Name *">
              <Input
                data-testid="staff-name"
                name="staff-display-name"
                autoComplete="off"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </F>
            <F label="Email *" hint={tenantSlug ? `Suggested: ${suggestedEmail}` : "Tenant slug not detected — enter email manually."}>
              <div className="flex gap-2">
                <Input
                  data-testid="staff-email"
                  name="staff-account-id"
                  autoComplete="off"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder={suggestedEmail || `${ROLE_PREFIX[form.role] || form.role}1@your-slug.jansetu.in`}
                />
                <button
                  type="button"
                  onClick={generateEmail}
                  disabled={!tenantSlug}
                  data-testid="staff-email-generate"
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                  title="Generate tenant-scoped email"
                >
                  <Wand2 size={12} /> Generate
                </button>
              </div>
            </F>
            <F label="Password *">
              <Input
                type="password"
                data-testid="staff-pass"
                name="staff-secret"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </F>
            <F label="Role">
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="staff-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["worker", "pa", "politician", "admin"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Designation">
              <Input
                data-testid="staff-desig"
                name="staff-title"
                autoComplete="off"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
            </F>
            <F label="Mobile">
              <Input
                data-testid="staff-mobile"
                name="staff-contact"
                autoComplete="off"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </F>
          </div>
          <Button type="submit" className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" data-testid="staff-submit">Add staff</Button>
        </form>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No staff yet" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Name</Th><Th>Role</Th><Th>Email</Th><Th>Designation</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                  <td className="px-4 py-3"><span className="pill pill-info"><ShieldCheck size={11} /> {u.role}</span></td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.designation || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const F = ({ label, hint, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
    {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
  </div>
);
const Th = ({ children }) => <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{children}</th>;
