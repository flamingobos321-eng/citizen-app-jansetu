import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, StatCard } from "../components/Common";

export default function CitizenProfile() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0 });
  const [hh, setHh] = useState(null);
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    api.get("/dashboard/citizen-stats").then((r) => setStats(r.data)).catch(() => {});
    if (user?.household_id) api.get(`/households/${user.household_id}`).then((r) => setHh(r.data.household));
    api.get("/areas").then((r) => setAreas(r.data));
  }, [user]);

  const wardName = areas.find((a) => a.id === user?.ward_id)?.name;
  const villageName = areas.find((a) => a.id === user?.village_id)?.name;

  return (
    <div className="space-y-6 animate-fade-up max-w-4xl">
      <SectionTitle subtitle="Your details and constituency record">My Profile</SectionTitle>
      <div className="bg-white border border-gray-200 rounded-lg p-6 grid sm:grid-cols-2 gap-4 text-sm">
        <Row label="Name" value={user?.name} />
        <Row label="Mobile" value={user?.mobile} />
        <Row label="Gender" value={user?.gender} />
        <Row label="Region" value={user?.region_type} />
        <Row label="Ward" value={wardName || "—"} />
        <Row label="Village" value={villageName || "—"} />
        <Row label="Household ID" value={hh?.household_code} />
        <Row label="House Number" value={user?.house_number} />
        <Row label="Address" value={user?.address} />
        <Row label="Family Head" value={hh?.family_head_name} />
        <Row label="Household Members" value={hh?.members_count} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Issues" value={stats.total} testId="profile-total" />
        <StatCard label="Resolved" value={stats.resolved} accent="text-[#10B981]" testId="profile-resolved" />
        <StatCard label="Pending" value={stats.pending} accent="text-[#B45309]" testId="profile-pending" />
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</div>
    <div className="text-gray-900 mt-0.5">{value || "—"}</div>
  </div>
);
