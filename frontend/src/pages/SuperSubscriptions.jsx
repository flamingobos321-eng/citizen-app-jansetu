import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { CreditCard, AlertCircle } from "lucide-react";

export default function SuperSubscriptions() {
  const { user } = useAuth();
  const [portals, setPortals] = useState([]);
  useEffect(() => { api.get("/admin/portals").then((r) => setPortals(r.data || [])).catch(() => {}); }, []);

  if (user && user.role !== "super_admin") return <div className="p-8"><EmptyState title="Super Admin only" hint="" /></div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Per-portal subscription plans, billing cycle and expiry.">Subscriptions</SectionTitle>
      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
        <AlertCircle size={14} /> Billing integration is planned. Current view shows configured plan metadata only.
      </div>
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {portals.length === 0 ? <div className="p-6 text-sm text-gray-500">No portals yet.</div> : portals.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3 flex-wrap" data-testid={`sub-row-${p.slug}`}>
            <div className="w-10 h-10 rounded-md flex items-center justify-center text-white font-heading text-base font-bold shrink-0" style={{ backgroundColor: p.theme_color || "#0A1128" }}>
              {(p.politician_name || "P").charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-semibold text-gray-900 truncate">{p.constituency_name}</div>
              <div className="text-xs text-gray-500">{p.politician_name}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-gray-700"><CreditCard size={12} /> {p.subscription_plan || "—"}</div>
              <span className="text-gray-500">Start: {p.subscription_start || "—"}</span>
              <span className="text-gray-500">Expiry: {p.subscription_expiry || "—"}</span>
              <span className="text-gray-500">Staff cap: {p.max_staff_limit ?? "—"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
