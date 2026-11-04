import PagePanel from "../../components/PagePanel";

export default function VisitsWorks() {
  return (
    <PagePanel tone="dark" eyebrow="Development Works" page="09" title="Development works, tracked in the open">
      <p className="page-copy mt-[2.4vh]">Each road, drain or hall is recorded with location, status and completion timeline, so staff answer citizens with facts.</p>
      <div className="mt-auto">
        <p className="label mb-[1.4vh]">A work's timeline</p>
        <p className="font-display text-[2.2vw] font-bold leading-[1.3]">Proposed → Started → In progress → Completed</p>
      </div>
    </PagePanel>
  );
}
