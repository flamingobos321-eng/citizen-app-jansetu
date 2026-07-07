import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { portalAssetUrl } from "../lib/api";
import { Facebook, Twitter, Instagram, Youtube, Phone, Mail, MapPin, Clock, ExternalLink, Archive } from "lucide-react";
import "./portal.css";

// Convert hex (#RRGGBB) to rgba with a given alpha. Defensive: returns fallback on bad input.
function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== "string") return `rgba(10,17,40,${alpha})`;
  const m = hex.replace("#", "");
  if (m.length !== 6) return `rgba(10,17,40,${alpha})`;
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function PortalLayout({ config, children }) {
  const { user } = useAuth();
  const primary = config?.theme_color || "#0A1128";
  const style = {
    "--portal-primary": primary,
    "--portal-primary-fg": "#ffffff",
    "--portal-primary-50": hexToRgba(primary, 0.06),
    "--portal-primary-200": hexToRgba(primary, 0.18),
    "--portal-accent": config?.accent_color || "#B45309",
  };
  const social = config?.social_links || {};
  const slug = config?.slug;
  const officeCode = config?.office_code;
  const brandLink = officeCode ? `/o/${officeCode}` : `/portal/${slug}`;
  const loginParam = officeCode ? `office=${officeCode}` : `portal=${slug}`;

  // Multi-tenant session isolation:
  // A signed-in user is "belonging" to this portal only if their tenant_id
  // matches the portal/tenant id. Otherwise they're treated as anonymous on
  // this portal (login buttons shown, no Open Workspace button).
  const belongs = !!(user && user.tenant_id && config && user.tenant_id === config.id);
  const showSwitchNotice = !!(user && !belongs);

  // remember portal slug for return-after-login UX
  const rememberSlug = () => {
    try { sessionStorage.setItem("portal_slug", slug || ""); } catch (e) { /* ignore */ }
  };

  return (
    <div className="portal-root min-h-screen bg-white text-gray-900 font-sans" style={style} data-testid="portal-root">
      {config?.portal_status === "archived" && (
        <div className="bg-red-600 text-white" data-testid="portal-archived-banner">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 text-sm">
            <Archive size={18} className="shrink-0" />
            <div className="min-w-0">
              <div className="font-heading font-semibold">This portal has been archived.</div>
              <div className="text-xs text-red-100 mt-0.5">
                Public services, new logins, and updates are paused. If you were a citizen or staff member here, please contact the platform administrator.
              </div>
            </div>
          </div>
        </div>
      )}
      {/* HEADER */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/85 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to={brandLink} className="flex items-center gap-3 min-w-0" data-testid="portal-brand">
            {config?.logo_path ? (
              <img src={portalAssetUrl(config.logo_path)} alt="" className="w-10 h-10 rounded-md object-cover portal-ring" />
            ) : (
              <div className="w-10 h-10 rounded-md portal-bg-primary flex items-center justify-center font-heading text-base font-bold">
                {(config?.politician_name || "P").charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-heading text-base sm:text-lg font-bold text-gray-900 truncate">{config?.politician_name}</div>
              <div className="text-[11px] sm:text-xs text-gray-500 truncate">{config?.designation} · {config?.constituency_name}</div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {config?.portal_status === "archived" ? (
              <span className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md bg-gray-100 text-gray-500 cursor-not-allowed" data-testid="portal-archived-login-disabled">Logins disabled</span>
            ) : belongs ? (
              <Link to="/app" className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md portal-bg-primary hover:opacity-90" data-testid="portal-open-app">Open Workspace</Link>
            ) : (
              <>
                <Link onClick={rememberSlug} to={`/citizen/claim?${loginParam}`} className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md border border-gray-300 bg-white hover:bg-gray-50" data-testid="portal-citizen-claim">Claim Voter Record</Link>
                <Link onClick={rememberSlug} to={`/citizen/login?${loginParam}`} className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md border border-gray-200 hover:bg-gray-50" data-testid="portal-citizen-login">Citizen Login</Link>
                <Link onClick={rememberSlug} to={`/staff/login?${loginParam}`} className="px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md portal-bg-primary hover:opacity-90" data-testid="portal-staff-login">Staff Login</Link>
              </>
            )}
          </div>
        </div>
        {showSwitchNotice && (
          <div className="bg-amber-50 border-t border-amber-200 text-amber-900 text-xs px-4 sm:px-6 py-2" data-testid="portal-cross-tenant-notice">
            <span className="max-w-6xl mx-auto block">
              You are signed in to a different constituency. Sign in below to access <span className="font-semibold">{config?.constituency_name}</span>.
            </span>
          </div>
        )}
      </header>

      <main>{children}</main>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid md:grid-cols-3 gap-8">
          <div>
            <div className="font-heading text-lg font-bold text-gray-900">{config?.politician_name}</div>
            <div className="text-sm text-gray-500 mt-1">{config?.designation}</div>
            <div className="text-sm text-gray-500">{config?.constituency_name}</div>
            {config?.tagline && <div className="text-xs italic portal-text-primary mt-2">{config.tagline}</div>}
          </div>
          <div className="text-sm text-gray-700 space-y-2">
            <div className="font-bold uppercase text-[11px] tracking-widest text-gray-500">Contact Office</div>
            {config?.contact_phone && <div className="flex items-center gap-2"><Phone size={14} className="portal-text-primary" />{config.contact_phone}</div>}
            {config?.contact_email && <div className="flex items-center gap-2"><Mail size={14} className="portal-text-primary" />{config.contact_email}</div>}
            {config?.contact_address && <div className="flex items-start gap-2"><MapPin size={14} className="portal-text-primary mt-0.5" /><span>{config.contact_address}</span></div>}
            {config?.office_hours && <div className="flex items-center gap-2"><Clock size={14} className="portal-text-primary" />{config.office_hours}</div>}
          </div>
          <div>
            <div className="font-bold uppercase text-[11px] tracking-widest text-gray-500 mb-2">Follow</div>
            <div className="flex flex-wrap gap-2">
              {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:portal-soft" aria-label="Facebook"><Facebook size={16} /></a>}
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:portal-soft" aria-label="Twitter"><Twitter size={16} /></a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:portal-soft" aria-label="Instagram"><Instagram size={16} /></a>}
              {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:portal-soft" aria-label="YouTube"><Youtube size={16} /></a>}
              {social.whatsapp && <a href={social.whatsapp} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:portal-soft text-xs font-bold" aria-label="WhatsApp">WA</a>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 py-4 text-center text-[11px] text-gray-500">
          <Link to="/" className="hover:portal-text-primary inline-flex items-center gap-1">
            Powered by JanSetu <ExternalLink size={11} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
