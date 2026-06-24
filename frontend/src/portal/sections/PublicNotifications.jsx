import { Bell } from "lucide-react";
import { SectionShell } from "./DevWorksSection";

const fmt = (d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

export default function PublicNotifications({ items }) {
  if (!items || items.length === 0) {
    return (
      <SectionShell title="Public Notifications" icon={Bell}>
        <p className="text-sm text-gray-500">No public notices yet.</p>
      </SectionShell>
    );
  }
  return (
    <SectionShell title="Public Notifications" icon={Bell} subtitle="Announcements for all citizens.">
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((n) => (
          <div key={n.id} data-testid={`portal-notif-${n.id}`} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg portal-soft flex items-center justify-center shrink-0">
                <Bell size={16} className="portal-text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-heading font-semibold text-sm text-gray-900">{n.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{n.notif_type} · {fmt(n.created_at)}</div>
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-3 line-clamp-3">{n.body}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
