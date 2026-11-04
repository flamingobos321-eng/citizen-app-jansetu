import PagePanel from "../../components/PagePanel";

export default function Trust() {
  return (
    <PagePanel tone="navy" eyebrow="TRUST IS PART OF THE SERVICE" title="Useful records. Scoped access.">
      <div className="mt-[4vh]">
        <p className="page-copy">Separate, branded portals for each representative.</p>
        <div className="page-rule my-[2.2vh]" />
        <p className="page-copy">Role-scoped visibility and write access — need to know.</p>
        <div className="page-rule my-[2.2vh]" />
        <p className="page-copy">Audited transfers; history remains with the citizen.</p>
        <div className="page-rule my-[2.2vh]" />
        <p className="page-copy">Consent-based family links. No live voter GPS.</p>
      </div>
      <p className="page-detail absolute bottom-[5.5vh] left-[5.2vh] right-[5.2vh]">
        Built for nonpartisan service delivery — not individual political persuasion.
      </p>
    </PagePanel>
  );
}
