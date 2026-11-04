import PagePanel from "../../components/PagePanel";

export default function OfficeTeams() {
  return (
    <PagePanel eyebrow="Staff & Worker Management" page="08" title="Staff and worker management">
      <p className="page-copy mt-[2.4vh]">Assignments, follow-ups, campaign forms, tasks and responses are recorded by role.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Representative</span><span className="row-val">Reviews reports</span></div>
        <div className="row"><span className="row-key">Admin</span><span className="row-val">Manages staff, roles</span></div>
        <div className="row"><span className="row-key">PA</span><span className="row-val">Assigns, follows up</span></div>
        <div className="row"><span className="row-key">Worker</span><span className="row-val">Records field progress</span></div>
        <div className="row"><span className="row-key">Citizen</span><span className="row-val">Raises, tracks requests</span></div>
      </div>
    </PagePanel>
  );
}
