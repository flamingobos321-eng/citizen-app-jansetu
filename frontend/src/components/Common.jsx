export const STATUS_PILL = {
  New: "pill pill-new",
  "Under Review": "pill pill-info",
  Assigned: "pill pill-pending",
  "In Progress": "pill pill-pending",
  Resolved: "pill pill-resolved",
  Verified: "pill pill-resolved",
  Reopened: "pill pill-new",
  Planned: "pill pill-neutral",
  Approved: "pill pill-info",
  "Tender Issued": "pill pill-pending",
  "Work Started": "pill pill-pending",
  Completed: "pill pill-resolved",
  Draft: "pill pill-neutral",
  "Pending Approval": "pill pill-pending",
  Published: "pill pill-resolved",
};

export function StatusPill({ status, testId }) {
  const cls = STATUS_PILL[status] || "pill pill-neutral";
  return (
    <span className={cls} data-testid={testId}>
      {status}
    </span>
  );
}

export function SectionTitle({ children, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-gray-900 tracking-tight">{children}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, accent = "text-[#0A1128]", testId }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5" data-testid={testId}>
      <div className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</div>
      <div className={`mt-2 text-3xl font-heading font-bold tracking-tight ${accent}`}>{value}</div>
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
      <div className="font-heading text-lg font-semibold text-gray-700">{title}</div>
      {hint && <div className="text-sm text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
