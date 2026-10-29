import { Hammer, CheckCircle2 } from "lucide-react";

export default function DevWorksSection({ works }) {
  if (!works || works.length === 0) {
    return (
      <SectionShell title="Development Works" icon={Hammer}>
        <p className="text-sm text-gray-500">No public development projects to display yet.</p>
      </SectionShell>
    );
  }
  return (
    <SectionShell title="Development Works" icon={Hammer} subtitle="Approved & ongoing public infrastructure projects.">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {works.map((w) => (
          <div key={w.id} data-testid={`portal-devwork-${w.id}`} className="bg-white border border-gray-200 rounded-xl p-4 hover:portal-ring transition">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg portal-soft flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} className="portal-text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-heading font-semibold text-sm text-gray-900">{w.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{w.category} · {w.location}</div>
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-3 line-clamp-2">{w.description}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="pill pill-info">{w.status}</span>
              {w.budget && <span className="text-gray-500">₹ {Number(w.budget).toLocaleString("en-IN")}</span>}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export function SectionShell({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 portal-text-primary">
            {Icon && <Icon size={16} />}
            <div className="text-[11px] uppercase tracking-widest font-bold">Section</div>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mt-1">{title}</h2>
          {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}
