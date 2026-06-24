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

export default function PortalHome() {
  const { slug } = useParams();
  const [config, setConfig] = useState(null);
  const [devworks, setDevworks] = useState([]);
  const [visits, setVisits] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setError(null);
    api.get(`/portals/${slug}`).then((r) => setConfig(r.data)).catch(() => setError("This portal is unavailable."));
    api.get(`/portals/${slug}/devworks`).then((r) => setDevworks(r.data)).catch(() => {});
    api.get(`/portals/${slug}/visits`).then((r) => setVisits(r.data)).catch(() => {});
    api.get(`/portals/${slug}/notifications`).then((r) => setNotifs(r.data)).catch(() => {});
  }, [slug]);

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
