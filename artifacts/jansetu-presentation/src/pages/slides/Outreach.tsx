import PagePanel from "../../components/PagePanel";

export default function Outreach() {
  return (
    <PagePanel eyebrow="Visit Management" page="10" title="Visit management for camps and inspections">
      <p className="page-copy mt-[2.4vh]">Schedule visits, camps and inspections. Citizens in the selected wards or villages are notified automatically.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Plan</span><span className="row-val">Date, place, purpose</span></div>
        <div className="row"><span className="row-key">Notify</span><span className="row-val">Selected areas</span></div>
        <div className="row"><span className="row-key">Record</span><span className="row-val">Visit history</span></div>
      </div>
    </PagePanel>
  );
}
