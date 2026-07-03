import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { CreditCard, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
];

function daysUntil(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return Math.round((d - new Date()) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

export default function SuperSubscriptions() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    service_start_date: "", billing_cycle: "monthly",
    agreed_amount: "", next_renewal_date: "", billing_notes: "",
  });

  const load = () => {
    api.get("/admin/subscriptions").then((r) => setRows(r.data || [])).catch(() => setRows([]));
  };
  useEffect(() => { load(); }, []);

  if (user && user.role !== "super_admin") {
    return <div className="p-8"><EmptyState title="Super Admin only" /></div>;
  }

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      service_start_date: row.service_start_date || "",
      billing_cycle: row.billing_cycle || "monthly",
      agreed_amount: row.agreed_amount ?? "",
      next_renewal_date: row.next_renewal_date || "",
      billing_notes: row.billing_notes || "",
    });
  };

  const save = async () => {
    try {
      const payload = {
        service_start_date: form.service_start_date || null,
        billing_cycle: form.billing_cycle || null,
        agreed_amount: form.agreed_amount === "" ? null : Number(form.agreed_amount),
        next_renewal_date: form.next_renewal_date || null,
        billing_notes: form.billing_notes || null,
      };
      // Strip nulls so backend doesn't overwrite with null.
      Object.keys(payload).forEach((k) => { if (payload[k] === null || payload[k] === "") delete payload[k]; });
      await api.put(`/admin/subscriptions/${editing.id}`, payload);
      toast.success("Subscription updated");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Per-portal billing cycle, agreed amount and renewal tracking.">
        Client Subscriptions
      </SectionTitle>

      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
        <AlertCircle size={14} />
        Manual billing today (Razorpay/Stripe integration deferred). Update service dates, cycle and agreed amount here to keep the renewal calendar accurate.
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No client portals yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((p) => {
              const inDays = daysUntil(p.next_renewal_date);
              const overdue = inDays !== null && inDays < 0;
              const soon = inDays !== null && inDays >= 0 && inDays <= 15;
              return (
                <div
                  key={p.id}
                  className="p-4 flex items-center gap-3 flex-wrap"
                  data-testid={`sub-row-${p.slug}`}
                >
                  <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading text-base font-bold shrink-0">
                    {(p.constituency_name || "P").charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-semibold text-gray-900 truncate">{p.constituency_name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {p.politician_name || p.tenant_name} · {p.slug}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <span className={`pill ${p.portal_status === "active" || p.is_active ? "pill-resolved" : "pill-neutral"}`}>
                      {p.portal_status || (p.is_active ? "active" : "inactive")}
                    </span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <CreditCard size={12} /> {(p.billing_cycle || "—").replace("_", " ")}
                    </span>
                    <span className="text-gray-500">₹ {p.agreed_amount ?? "—"}</span>
                    <span className="text-gray-500">Start: {p.service_start_date || "—"}</span>
                    <span className={overdue ? "text-red-600 font-semibold" : soon ? "text-amber-700 font-semibold" : "text-gray-500"}>
                      Renewal: {p.next_renewal_date || "—"}
                      {inDays !== null && (overdue ? ` (overdue by ${Math.abs(inDays)}d)` : ` (in ${inDays}d)`)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(p)}
                    data-testid={`sub-edit-${p.slug}`}
                  >
                    <Pencil size={12} className="mr-1.5" /> Edit
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md" data-testid="sub-edit-dialog">
          <DialogHeader>
            <DialogTitle>Subscription — {editing?.constituency_name}</DialogTitle>
            <DialogDescription>Track billing cycle, agreed amount and next renewal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <F label="Service Start Date">
              <Input
                type="date"
                data-testid="sub-start-date"
                value={form.service_start_date}
                onChange={(e) => setForm((f) => ({ ...f, service_start_date: e.target.value }))}
              />
            </F>
            <F label="Billing Cycle">
              <Select
                value={form.billing_cycle}
                onValueChange={(v) => setForm((f) => ({ ...f, billing_cycle: v }))}
              >
                <SelectTrigger data-testid="sub-cycle"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Agreed Amount (₹)">
              <Input
                type="number"
                min="0"
                step="0.01"
                data-testid="sub-amount"
                value={form.agreed_amount}
                onChange={(e) => setForm((f) => ({ ...f, agreed_amount: e.target.value }))}
              />
            </F>
            <F label="Next Renewal Date">
              <Input
                type="date"
                data-testid="sub-renewal"
                value={form.next_renewal_date}
                onChange={(e) => setForm((f) => ({ ...f, next_renewal_date: e.target.value }))}
              />
            </F>
            <F label="Notes">
              <Textarea
                rows={2}
                data-testid="sub-notes"
                value={form.billing_notes}
                onChange={(e) => setForm((f) => ({ ...f, billing_notes: e.target.value }))}
              />
            </F>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              onClick={save}
              data-testid="sub-save"
            >
              Save
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
