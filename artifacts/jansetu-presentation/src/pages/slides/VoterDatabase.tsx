import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function VoterDatabase() {
  return (
    <PagePanel eyebrow="Constituency Transfer" title="A move changes context, not the record.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Service histories remain useful when a citizen moves between constituencies.</p>
          <p className="page-copy mt-[3vh]">Teams work from the recorded address and area, with transfer history preserved and audited.</p>
          <p className="page-detail mt-[3vh]">Area and address are maintained records — not live GPS tracking.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-profile.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--medium rounded-[2.4vh]"
          alt="JanSetu mobile app profile screen"
        />
      </div>
    </PagePanel>
  );
}
