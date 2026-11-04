import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Families() {
  return (
    <PagePanel tone="dark" eyebrow="Household Management" page="05" title="Households and family relationships">
      <div className="mt-[2vh] flex gap-[3vh]">
        <div className="flex-1">
          <p className="page-copy">Group household members by recorded address, with a family head.</p>
          <p className="page-copy mt-[1.6vh]">Family relationships are separate links, not inferred from voter rolls.</p>
          <p className="page-copy mt-[1.6vh]">Cross-constituency links need acceptance. Each person's records stay with their own office.</p>
        </div>
        <img src={`${base}mobile-screens/citizen-family.png`} crossOrigin="anonymous" className="phone-shot h-[34vh] self-start" alt="JanSetu family screen" />
      </div>
      <div className="page-foot"><span>Family screen</span><span>Links by choice</span></div>
    </PagePanel>
  );
}
