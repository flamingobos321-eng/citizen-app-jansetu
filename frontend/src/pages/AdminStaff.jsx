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
import { Plus, ShieldCheck } from "lucide-react";

export default function AdminStaff() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "worker", designation: "", mobile: "" });

  const load = () => api.get("/users").then((r) => setUsers(r.data.filter((u) => u.role !== "citizen")));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return toast.error("Name, email, password required");
    try {
      await api.post("/admin/staff", form);
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <F label="Name *"><Input data-testid="staff-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></F>
          <F label="Email *"><Input data-testid="staff-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></F>
          <F label="Password *"><Input type="password" data-testid="staff-pass" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></F>
          <F label="Role">
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
              <SelectTrigger data-testid="staff-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["worker", "pa", "politician", "admin"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
          <F label="Designation"><Input data-testid="staff-desig" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} /></F>
          <F label="Mobile"><Input data-testid="staff-mobile" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></F>
        </div>
        <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} data-testid="staff-submit">Add staff</Button>
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

const F = ({ label, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
    {children}
  </div>
);
const Th = ({ children }) => <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{children}</th>;
