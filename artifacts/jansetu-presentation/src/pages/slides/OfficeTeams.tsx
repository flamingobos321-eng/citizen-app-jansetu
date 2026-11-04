import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function OfficeTeams() {
  return (
    <PagePanel eyebrow="A TEAM WITH DEFINED ROLES" title="Give each role a useful view and a clear remit.">
      <div className="mt-[4vh] space-y-[2.8vh]">
        <p className="page-copy"><strong>Field workers</strong> — record visits and local follow-up.</p>
        <p className="page-copy"><strong>Office staff &amp; PA</strong> — coordinate requests and assignments.</p>
        <p className="page-copy"><strong>Politician &amp; admin</strong> — review constituency work and access.</p>
      </div>
      <div className="mt-[3.5vh] flex items-center gap-[3vh]">
        <img
          src={`${base}mobile-screens/office-signin.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--short rounded-[2.4vh]"
          alt="JanSetu mobile app office sign-in screen"
        />
        <p className="page-detail max-w-[34vh]">Office access starts with sign-in. No authenticated office walkthrough is claimed here.</p>
      </div>
    </PagePanel>
  );
}
