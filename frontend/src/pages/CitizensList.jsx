import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SectionTitle, EmptyState } from "../components/Common";
import { Input } from "../components/ui/input";
import { Search, Home, ChevronRight } from "lucide-react";

export default function CitizensList() {
  const [hh, setHh] = useState([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    api.get("/households", { params }).then((r) => setHh(r.data));
  }, [search]);

  useEffect(() => {
    if (!active) return;
    api.get(`/households/${active}`).then((r) => setDetail(r.data));
  }, [active]);

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Search households, view members and full issue history">Citizens & Households</SectionTitle>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input data-testid="hh-search" className="pl-10" placeholder="Search by code, name, house…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto divide-y divide-gray-100">
            {hh.length === 0 && <div className="p-6 text-sm text-gray-500">No households found.</div>}
            {hh.map((h) => (
              <button
                key={h.id}
                onClick={() => setActive(h.id)}
                data-testid={`hh-${h.household_code}`}
                className={`w-full text-left p-4 hover:bg-gray-50 ${active === h.id ? "bg-gray-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-gray-500">{h.household_code}</div>
                  <ChevronRight size={14} className="text-gray-400" />
                </div>
                <div className="font-semibold text-sm text-gray-900 mt-0.5">{h.family_head_name}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{h.address}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!detail ? (
            <EmptyState title="Select a household" hint="Pick from the left to view members and issue history" />
          ) : (
            <div className="space-y-5">
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center">
                    <Home size={18} />
                  </div>
                  <div>
                    <div className="font-mono text-xs text-gray-500">{detail.household.household_code}</div>
                    <div className="font-heading font-bold text-gray-900">{detail.household.family_head_name}</div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
                  <Row label="House #" value={detail.household.house_number} />
                  <Row label="Members" value={detail.household.members_count} />
                  <Row label="Region" value={detail.household.region_type} />
                  <Row label="Address" value={detail.household.address} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-heading font-semibold text-gray-900 mb-3">Members ({detail.members.length})</h3>
                <div className="divide-y divide-gray-100">
                  {detail.members.map((m) => (
                    <div key={m.id} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{m.name}</div>
                        <div className="text-xs text-gray-500">{m.mobile} · {m.gender}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-heading font-semibold text-gray-900 mb-3">Development benefits ({detail.benefits?.length || 0})</h3>
                {(!detail.benefits || detail.benefits.length === 0) ? (
                  <div className="text-sm text-gray-500">No approved development works for this area yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {detail.benefits.map((b) => (
                      <div key={b.id} className="py-3">
                        <div className="font-semibold text-sm text-gray-900">{b.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{b.category} · <span className="pill pill-neutral">{b.status}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <h3 className="font-heading font-semibold text-gray-900 mb-3">Service history ({detail.issues.length})</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Stat label="Total" value={detail.stats?.total ?? detail.issues.length} color="text-[#0A1128]" />
                  <Stat label="Resolved" value={detail.stats?.resolved ?? 0} color="text-[#10B981]" />
                  <Stat label="Pending" value={detail.stats?.pending ?? 0} color="text-[#B45309]" />
                </div>
                {detail.issues.length === 0 ? (
                  <div className="text-sm text-gray-500">No issues raised yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {detail.issues.map((i) => (
                      <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-gray-500">{i.issue_code}</div>
                          <div className="font-semibold text-sm text-gray-900 truncate">{i.title}</div>
                        </div>
                        <div className="text-xs">
                          <span className="pill pill-neutral">{i.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</div>
    <div className="text-sm text-gray-900 mt-0.5">{value || "—"}</div>
  </div>
);

const Stat = ({ label, value, color }) => (
  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</div>
    <div className={`font-heading text-2xl font-bold mt-0.5 ${color}`}>{value}</div>
  </div>
);
