import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { AlertCircle, ListChecks, UserCircle, Megaphone } from "lucide-react";

const rememberSlug = (slug) => {
  try { sessionStorage.setItem("portal_slug", slug || ""); } catch (e) { /* ignore */ }
};

export default function CitizenServices({ slug }) {
  const { user } = useAuth();
  const isCitizen = user?.role === "citizen";

  const items = [
    { icon: AlertCircle, label: "Raise a Complaint", to: isCitizen ? "/app/raise" : `/citizen/login?portal=${slug}` },
    { icon: ListChecks, label: "Track My Issues",   to: isCitizen ? "/app/my-issues" : `/citizen/login?portal=${slug}` },
    { icon: UserCircle, label: "My Profile",         to: isCitizen ? "/app/profile" : `/citizen/login?portal=${slug}` },
    { icon: Megaphone,  label: "Public Notices",     to: isCitizen ? "/app/notifications" : `/citizen/login?portal=${slug}` },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-10" data-testid="portal-citizen-services">
      <div className="bg-white rounded-2xl portal-ring p-3 sm:p-4 grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 shadow-sm">
        {items.map((it, i) => (
          <Link
            key={i}
            to={it.to}
            onClick={() => rememberSlug(slug)}
            data-testid={`portal-cta-${i}`}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border border-gray-100 hover:portal-soft transition group"
          >
            <div className="w-10 h-10 rounded-lg portal-bg-primary flex items-center justify-center shrink-0">
              <it.icon size={18} />
            </div>
            <div className="font-heading font-semibold text-sm text-gray-900 group-hover:portal-text-primary">{it.label}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
