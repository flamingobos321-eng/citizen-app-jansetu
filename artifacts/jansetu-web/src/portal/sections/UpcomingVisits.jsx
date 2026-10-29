import { CalendarClock, MapPin } from "lucide-react";
import { SectionShell } from "./DevWorksSection";

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

export default function UpcomingVisits({ visits }) {
  if (!visits || visits.length === 0) {
    return (
      <SectionShell title="Upcoming Visits" icon={CalendarClock}>
        <p className="text-sm text-gray-500">No upcoming visits scheduled.</p>
      </SectionShell>
    );
  }
  return (
    <SectionShell title="Upcoming Visits" icon={CalendarClock} subtitle="Scheduled engagements with citizens.">
      <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-xl">
        {visits.map((v) => (
          <div key={v.id} data-testid={`portal-visit-${v.id}`} className="p-4 sm:p-5 flex items-start gap-4">
            <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl portal-soft shrink-0">
              <div className="text-[10px] uppercase font-bold portal-text-primary">{new Date(v.date).toLocaleString("en-IN", { month: "short" })}</div>
              <div className="font-heading text-xl font-bold portal-text-primary leading-none">{new Date(v.date).getDate()}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-heading font-semibold text-gray-900">{v.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span>{fmtDate(v.date)} · {v.time}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={11} /> {v.location}</span>
                <span className="pill pill-info">{v.visit_type}</span>
              </div>
              {v.description && <p className="text-sm text-gray-700 mt-2 line-clamp-2">{v.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
