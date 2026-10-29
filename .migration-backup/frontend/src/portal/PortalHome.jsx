import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import PortalLayout from "./PortalLayout";
import WelcomeBanner from "./sections/WelcomeBanner";
import CitizenServices from "./sections/CitizenServices";
import DevWorksSection from "./sections/DevWorksSection";
import UpcomingVisits from "./sections/UpcomingVisits";
import PublicNotifications from "./sections/PublicNotifications";
import ContactOffice from "./sections/ContactOffice";

// Regex for the new Office-Code URLs — /o/JS1045.
const OFFICE_CODE_RE = /^JS\d{4,}$/i;

export default function PortalHome() {
  // The same component serves both routes:
  //   /o/:code    — new Office-Code URL (canonical)
  //   /portal/:slug — legacy URL (backwards compat)
  const params = useParams();
  const identifier = (params.code || params.slug || "").trim();
  // Slug endpoints happily accept Office Codes too (see backend
  // `_resolve_tenant_id`), so we can use ONE code path for both. But for the
  // legacy per-slug endpoints (`/portals/{slug}/devworks|visits|notifications`)
  // we need to resolve the actual slug when the URL is an Office Code.
  const isCode = OFFICE_CODE_RE.test(identifier);
  const [config, setConfig] = useState(null);
  const [devworks, setDevworks] = useState([]);
  const [visits, setVisits] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!identifier) return;
    setError(null);
    const upper = identifier.toUpperCase();
    const bootstrap = isCode
      ? api.get(`/portals/office/${upper}`)
      : api.get(`/portals/${identifier}`);
    bootstrap
      .then((r) => {
        setConfig(r.data);
        // Downstream section calls always use the row's canonical slug so
        // legacy `/portals/{slug}/…` endpoints keep working.
        const slugForFeeds = r.data.slug;
        if (!slugForFeeds) return;
        api.get(`/portals/${slugForFeeds}/devworks`).then((x) => setDevworks(x.data)).catch(() => {});
        api.get(`/portals/${slugForFeeds}/visits`).then((x) => setVisits(x.data)).catch(() => {});
        api.get(`/portals/${slugForFeeds}/notifications`).then((x) => setNotifs(x.data)).catch(() => {});
      })
      .catch(() => setError("This portal is unavailable."));
  }, [identifier, isCode]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8">
        <div>
          <div className="font-heading text-2xl font-bold text-gray-900">Portal unavailable</div>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  if (!config) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>;

  return (
    <PortalLayout config={config}>
      <WelcomeBanner config={config} />
      <CitizenServices slug={config.slug} />
      <DevWorksSection works={devworks} />
      <UpcomingVisits visits={visits} />
      <PublicNotifications items={notifs} />
      <ContactOffice config={config} />
    </PortalLayout>
  );
}
