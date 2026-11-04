import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Resolution() {
  return (
    <PagePanel tone="dark" eyebrow="Issue Management" page="07" title="Issue management with clear ownership">
      <div className="mt-[2.4vh] flex gap-[3vh]">
        <img src={`${base}mobile-screens/citizen-issues.png`} crossOrigin="anonymous" className="phone-shot h-[40vh] self-start" alt="JanSetu issues screen" />
        <div className="flex-1">
          <p className="page-copy">Each request has an owner, can be reassigned, and is tracked against a response time.</p>
          <p className="page-copy mt-[1.6vh]">Once resolved, the citizen can rate it.</p>
        </div>
      </div>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Status</span><span className="row-val">New → … → Verified</span></div>
        <div className="row"><span className="row-key">Ownership</span><span className="row-val">Assign, reassign, SLA</span></div>
      </div>
      <div className="page-foot"><span>Issues screen</span><span>Citizen rating at close</span></div>
    </PagePanel>
  );
}
