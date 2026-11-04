import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Informed() {
  return (
    <PagePanel eyebrow="LOCAL UPDATES, CLEARLY DELIVERED" title="Keep citizens informed about what matters nearby.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Publish announcements for selected wards, villages or the whole constituency.</p>
          <p className="page-copy mt-[3vh]">Send visit notifications to the communities selected for a camp, inspection or representative visit.</p>
          <p className="page-detail mt-[3vh]">Area-targeted public service communication.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-services.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--medium rounded-[2.4vh]"
          alt="JanSetu mobile app services screen"
        />
      </div>
    </PagePanel>
  );
}
