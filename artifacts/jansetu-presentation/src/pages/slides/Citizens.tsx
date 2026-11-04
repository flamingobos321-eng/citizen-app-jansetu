import PagePanel from "../../components/PagePanel";

export default function Citizens() {
  return (
    <PagePanel tone="dark" eyebrow="Reports & Analytics" page="13" title="Reports and analytics for the office">
      <p className="page-copy mt-[2.4vh]">An issue MIS shows open, assigned and verified requests. Household and ward summaries show where work is concentrated.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Issue MIS</span><span className="row-val">Status, owner, age</span></div>
        <div className="row"><span className="row-key">Summaries</span><span className="row-val">Household and ward</span></div>
        <div className="row"><span className="row-key">Export</span><span className="row-val">CSV download</span></div>
      </div>
    </PagePanel>
  );
}
