import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Families() {
  return (
    <PagePanel tone="blue" eyebrow="HOUSEHOLDS, WITH CONSENT" title="Connect family records without guessing.">
      <div className="mt-[3vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Households can be grouped by recorded address, family head, members and lineage.</p>
          <p className="page-copy mt-[3vh]">Father, mother, spouse and sibling links are explicit and consent-based.</p>
          <p className="page-detail mt-[3vh]">Approved links remain with the citizen across constituencies.</p>
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
