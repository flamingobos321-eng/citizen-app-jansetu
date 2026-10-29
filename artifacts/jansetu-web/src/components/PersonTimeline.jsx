import { useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  FileText, Bell, Hammer, Calendar, ArrowRightLeft, UserPlus,
  CheckCircle2, MessageSquare, Users as UsersIcon, RefreshCw,
} from "lucide-react";

const EVENT_META = {
  registered: { icon: UserPlus, color: "text-emerald-600", label: "Registered" },
  membership_created: { icon: UserPlus, color: "text-emerald-600", label: "Membership created" },
  membership_archived: { icon: ArrowRightLeft, color: "text-amber-600", label: "Membership archived" },
  membership_transferred: { icon: ArrowRightLeft, color: "text-amber-600", label: "Transferred" },
  complaint_raised: { icon: FileText, color: "text-rose-600", label: "Complaint raised" },
  complaint_assigned: { icon: RefreshCw, color: "text-indigo-600", label: "Assigned" },
  complaint_in_progress: { icon: RefreshCw, color: "text-indigo-600", label: "In progress" },
  complaint_reassigned: { icon: RefreshCw, color: "text-indigo-600", label: "Reassigned" },
  complaint_resolved: { icon: CheckCircle2, color: "text-emerald-600", label: "Resolved" },
  complaint_feedback: { icon: MessageSquare, color: "text-violet-600", label: "Feedback" },
  visit_announced: { icon: Calendar, color: "text-blue-600", label: "Visit announced" },
  visit_approved: { icon: Calendar, color: "text-blue-600", label: "Visit approved" },
  visit_logged: { icon: Calendar, color: "text-blue-600", label: "Visit attended" },
  devwork_announced: { icon: Hammer, color: "text-amber-600", label: "Devwork announced" },
  devwork_completed: { icon: Hammer, color: "text-emerald-600", label: "Devwork completed" },
  devwork_benefited: { icon: Hammer, color: "text-emerald-600", label: "Benefit received" },
  notification_published: { icon: Bell, color: "text-gray-600", label: "Notification" },
  interaction_logged: { icon: MessageSquare, color: "text-violet-600", label: "Interaction" },
  household_changed: { icon: UsersIcon, color: "text-gray-600", label: "Household changed" },
  profile_updated: { icon: UserPlus, color: "text-gray-600", label: "Profile updated" },
  relationship_added: { icon: UsersIcon, color: "text-gray-600", label: "Relationship added" },
  relationship_removed: { icon: UsersIcon, color: "text-gray-600", label: "Relationship removed" },
};

/**
 * PersonTimeline — renders Person 360 timeline events.
 *
 * @param scope "self" (citizen self-view → GET /me/timeline cross-tenant)
 *              or "staff" (staff view of a target → GET /persons/{id}/timeline
 *              tenant-scoped).
 * @param personUserId V1 user id of the target (required when scope==="staff").
 * @param limit max events to fetch.
 */
export function PersonTimeline({ scope = "self", personUserId, limit = 100 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = scope === "staff"
      ? `/persons/${personUserId}/timeline?limit=${limit}`
      : `/me/timeline?limit=${limit}`;
    setLoading(true);
    api.get(url)
      .then((r) => setEvents(r.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [scope, personUserId, limit]);

  if (loading) {
    return <div className="text-sm text-gray-400 px-2 py-6">Loading timeline…</div>;
  }
  if (!events.length) {
    return (
      <div data-testid="person-timeline-empty" className="text-sm text-gray-400 px-2 py-6">
        No timeline events yet.
      </div>
    );
  }
  return (
    <ol data-testid="person-timeline" className="relative border-l border-gray-200 pl-6 space-y-5 ml-2">
      {events.map((e) => {
        const meta = EVENT_META[e.event_type] || { icon: FileText, color: "text-gray-500", label: e.event_type };
        const Icon = meta.icon;
        return (
          <li key={e.id} data-testid={`timeline-event-${e.event_type}`} className="relative">
            <span className={`absolute -left-[33px] top-1 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 ${meta.color}`}>
              <Icon size={12} />
            </span>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-[0.1em] text-gray-400">
                {meta.label}
              </span>
              <span className="text-xs text-gray-400">{new Date(e.at).toLocaleString()}</span>
            </div>
            <div className="font-semibold text-sm text-gray-900 mt-0.5">{e.label}</div>
            {e.summary && <div className="text-xs text-gray-500 mt-0.5">{e.summary}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export default PersonTimeline;
