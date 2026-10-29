import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { SectionShell } from "./DevWorksSection";

export default function ContactOffice({ config }) {
  const cells = [
    { icon: Phone, label: "Phone", value: config.contact_phone, href: config.contact_phone ? `tel:${config.contact_phone}` : null },
    { icon: Mail, label: "Email", value: config.contact_email, href: config.contact_email ? `mailto:${config.contact_email}` : null },
    { icon: MapPin, label: "Address", value: config.contact_address, href: null },
    { icon: Clock, label: "Office Hours", value: config.office_hours, href: null },
  ].filter((c) => c.value);

  if (cells.length === 0) {
    return (
      <SectionShell title="Contact Office" icon={Phone}>
        <p className="text-sm text-gray-500">Contact details will appear here when configured.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell title="Contact Office" icon={Phone} subtitle="Reach the constituency office directly.">
      <div className="grid sm:grid-cols-2 gap-4">
        {cells.map((c, i) => (
          <div key={i} data-testid={`portal-contact-${i}`} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg portal-soft flex items-center justify-center shrink-0">
              <c.icon size={18} className="portal-text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest font-bold text-gray-500">{c.label}</div>
              {c.href ? (
                <a href={c.href} className="text-sm font-semibold text-gray-900 portal-link hover:underline break-words">{c.value}</a>
              ) : (
                <div className="text-sm font-semibold text-gray-900 break-words">{c.value}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
