import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Resolution() {
  return (
    <PagePanel tone="cobalt" eyebrow="Issue Management" title="Move each request toward a clear next step.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="font-display text-[3.1vw] font-bold leading-tight">New <span className="text-[#c9dbff]">→</span> Verified</p>
          <p className="page-copy mt-[3vh]">Reassign to the right team member. Track SLA progress. Capture a citizen rating after follow-up.</p>
          <p className="page-detail mt-[3vh]">One visible workflow for citizen requests.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-issues.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--compact rounded-[2.4vh]"
          alt="JanSetu mobile app issue status screen"
        />
      </div>
      <p className="page-detail absolute bottom-[5.5vh] left-[5.2vh]">The record shows progress; teams remain responsible for action.</p>
    </PagePanel>
  );
}
