import PagePanel from "../../components/PagePanel";

export default function Requests() {
  return (
    <PagePanel eyebrow="How it works" page="02" title="How JanSetu connects an office to its citizens">
      <p className="page-copy mt-[2vh]">Each step builds on the last.</p>
      <div className="mt-[2.4vh]">
        <div className="row"><span className="row-key">Voter record</span><span className="row-val">Imported from the roll</span></div>
        <div className="row"><span className="row-key">Mobile</span><span className="row-val">Verified by the citizen</span></div>
        <div className="row"><span className="row-key">Family</span><span className="row-val">Household and relatives</span></div>
        <div className="row"><span className="row-key">Request</span><span className="row-val">Raised in app or office</span></div>
        <div className="row"><span className="row-key">Allocation</span><span className="row-val">Given to a PA or worker</span></div>
        <div className="row"><span className="row-key">History</span><span className="row-val">Kept for reports</span></div>
      </div>
    </PagePanel>
  );
}
