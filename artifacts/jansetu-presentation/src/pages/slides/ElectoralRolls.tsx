import PagePanel from "../../components/PagePanel";

export default function ElectoralRolls() {
  return (
    <PagePanel tone="dark" eyebrow="Citizen CRM" page="03" title="Citizen CRM and electoral-roll imports">
      <p className="page-copy mt-[2.4vh]">English and Marathi roll PDFs are imported, and duplicate EPIC entries within the constituency are detected.</p>
      <p className="page-copy mt-[1.6vh]">Citizens claim their entry and confirm a current mobile by OTP.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Search</span><span className="row-val">EPIC, name, house, relative</span></div>
      </div>
    </PagePanel>
  );
}
