import PagePanel from "../../components/PagePanel";

export default function VoterClaim() {
  return (
    <PagePanel eyebrow="Person 360" page="04" title="Person 360: one record of service history">
      <p className="page-copy mt-[2.4vh]">One timeline per citizen, so staff see past requests, outcomes and who handled them.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Record</span><span className="row-val">Registration and contact</span></div>
        <div className="row"><span className="row-key">Service</span><span className="row-val">Complaints and visits</span></div>
        <div className="row"><span className="row-key">Area</span><span className="row-val">Public works nearby</span></div>
        <div className="row"><span className="row-key">Moves</span><span className="row-val">Audited transfers</span></div>
      </div>
    </PagePanel>
  );
}
