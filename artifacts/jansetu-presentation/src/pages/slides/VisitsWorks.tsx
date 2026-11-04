import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function VisitsWorks() {
  return (
    <PagePanel tone="blue" eyebrow="Visit Management" title="Plan visits. Let selected communities know.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Schedule representative visits, public camps and ward inspections.</p>
          <p className="page-copy mt-[3vh]">Choose wards, villages or the full constituency for announcements and visit notifications.</p>
          <p className="page-detail mt-[3vh]">Area-based service updates — not individual political persuasion.</p>
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
