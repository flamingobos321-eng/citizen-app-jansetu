import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";

export default function PortalIndex() {
  const [portals, setPortals] = useState(null);

  useEffect(() => {
    api.get("/portals").then((r) => setPortals(r.data || [])).catch(() => setPortals([]));
  }, []);

  if (portals === null) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;

  const def = portals.find((p) => p.is_default);
  if (def) return <Navigate to={`/portal/${def.slug}`} replace />;
  if (portals.length === 1) return <Navigate to={`/portal/${portals[0].slug}`} replace />;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="font-heading text-3xl font-bold text-gray-900">Constituency Portals</h1>
        <p className="text-sm text-gray-500 mt-2">Choose a portal to continue.</p>
        {portals.length === 0 ? (
          <div className="mt-8 p-8 bg-white border border-gray-200 rounded-xl text-sm text-gray-500">No active portals are configured yet.</div>
        ) : (
          <div className="mt-6 grid gap-3">
            {portals.map((p) => (
              <Link key={p.id} to={`/portal/${p.slug}`} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition flex items-center gap-3" data-testid={`portal-pick-${p.slug}`}>
                <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-heading text-lg font-bold" style={{ backgroundColor: p.theme_color || "#0A1128" }}>
                  {(p.politician_name || "P").charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-heading font-semibold text-gray-900">{p.politician_name}</div>
                  <div className="text-xs text-gray-500">{p.designation} · {p.constituency_name}</div>
                </div>
                <div className="ml-auto text-xs text-gray-400">→</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
