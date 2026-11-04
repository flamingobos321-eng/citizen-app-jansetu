import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function VoterClaim() {
  return (
    <PagePanel eyebrow="Person 360" title="One person. One service history.">
      <div className="mt-[3vh] flex items-start gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">A Person 360 timeline keeps the working context together:</p>
          <div className="mt-[3vh] space-y-[2.6vh]">
            <p className="page-copy">Registrations · complaints · contacts</p>
            <p className="page-copy">Visits · development work · transfers</p>
            <p className="page-copy">Per-constituency service context</p>
          </div>
        </div>
        <img
          src={`${base}mobile-screens/citizen-issues.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--medium rounded-[2.4vh]"
          alt="JanSetu mobile app issue history"
        />
      </div>
      <div className="absolute bottom-[5.5vh] left-[5.2vh] right-[5.2vh]">
        <div className="page-rule" />
        <p className="page-detail mt-[1.8vh]">An audited constituency transfer preserves history; it does not rewrite it.</p>
      </div>
    </PagePanel>
  );
}
