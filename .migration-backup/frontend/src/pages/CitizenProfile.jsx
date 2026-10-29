import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, StatCard } from "../components/Common";
import { FamilyLinkCard } from "../components/FamilyLinkCard";

const NOTIFICATION_CATEGORIES = [
  {
    key: "issue_updates",
    label: "Issue Updates",
    description: "Alerts when your submitted issues are assigned, resolved, or updated",
  },
  {
    key: "broadcasts",
    label: "Announcements",
    description: "Messages and announcements broadcast by your representative's office",
  },
  {
    key: "announcements",
    label: "General Alerts",
    description: "Reminders, events, and other general notifications",
  },
];

export default function CitizenProfile() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0 });
  const [hh, setHh] = useState(null);
  const [areas, setAreas] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [prefsSaving, setPrefsSaving] = useState({});
  const [prefsSaved, setPrefsSaved] = useState({});

  useEffect(() => {
    api.get("/dashboard/citizen-stats").then((r) => setStats(r.data)).catch(() => {});
    if (user?.household_id) api.get(`/households/${user.household_id}`).then((r) => setHh(r.data.household));
    api.get("/areas").then((r) => setAreas(r.data));
    api.get("/me/notification-prefs").then((r) => setPrefs(r.data)).catch(() => {});
  }, [user]);

  const wardName = areas.find((a) => a.id === user?.ward_id)?.name;
  const villageName = areas.find((a) => a.id === user?.village_id)?.name;

  const handleTogglePref = useCallback(
    async (key, value) => {
      setPrefs((prev) => ({ ...prev, [key]: value }));
      setPrefsSaving((s) => ({ ...s, [key]: true }));
      try {
        const updated = await api.put("/me/notification-prefs", { [key]: value });
        setPrefs(updated.data);
        setPrefsSaved((s) => ({ ...s, [key]: true }));
        setTimeout(() => setPrefsSaved((s) => ({ ...s, [key]: false })), 1500);
      } catch (_) {
        // revert on error
        setPrefs((prev) => ({ ...prev, [key]: !value }));
      } finally {
        setPrefsSaving((s) => ({ ...s, [key]: false }));
      }
    },
    []
  );

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

      {/* Notification Preferences */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Notification Preferences</h3>
        <p className="text-xs text-gray-500 mb-4">
          Choose which types of alerts you want to receive on your phone. Turning off a category
          silences push alerts but keeps them in your in-app inbox.
        </p>
        <div className="divide-y divide-gray-100">
          {NOTIFICATION_CATEGORIES.map(({ key, label, description }) => {
            const enabled = prefs ? prefs[key] !== false : true;
            const saving = prefsSaving[key];
            const saved = prefsSaved[key];
            return (
              <div key={key} className="flex items-start justify-between py-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{description}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saved && (
                    <span className="text-xs text-[#10B981] font-medium">Saved</span>
                  )}
                  <button
                    data-testid={`notif-pref-${key}`}
                    disabled={prefs === null || saving}
                    onClick={() => handleTogglePref(key, !enabled)}
                    aria-pressed={enabled}
                    aria-label={`${label}: ${enabled ? "on" : "off"}`}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
                      transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1B4FD8] focus:ring-offset-2
                      ${enabled ? "bg-[#1B4FD8]" : "bg-gray-200"}
                      ${prefs === null || saving ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                        transition duration-200 ease-in-out
                        ${enabled ? "translate-x-5" : "translate-x-0"}
                      `}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Family linking — pending invitations + outgoing requests */}
      <FamilyLinkCard />
    </div>
  );
}

const Row = ({ label, value }) => (
  <div>
    <div className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</div>
    <div className="text-gray-900 mt-0.5">{value || "—"}</div>
  </div>
);
