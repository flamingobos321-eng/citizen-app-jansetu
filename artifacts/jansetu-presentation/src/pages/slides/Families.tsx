import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Families() {
  return (
    <PagePanel tone="blue" eyebrow="Household Management · Family Relationships" title="Connect family records without guessing.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Households: grouped by recorded address.</p>
          <p className="page-copy mt-[3vh]">Family links: separate, explicit, consent-based.</p>
          <p className="page-detail mt-[3vh]">Approved links stay with the citizen.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-family.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--medium rounded-[2.4vh]"
          alt="JanSetu mobile app family screen"
        />
      </div>
      <p className="page-detail absolute bottom-[5.5vh] left-[5.2vh]">Relationships are never inferred from voter rolls.</p>
    </PagePanel>
  );
}
