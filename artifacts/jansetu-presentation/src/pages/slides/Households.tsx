import PagePanel from "../../components/PagePanel";

export default function Households() {
  return (
    <PagePanel tone="dark" eyebrow="Targeted Notifications" page="11" title="Targeted notifications by area">
      <p className="page-copy mt-[2.4vh]">Notices reach only the people they concern: one ward, chosen villages, or the whole constituency.</p>
      <div className="mt-auto flex flex-col gap-[1.6vh]">
        <div className="flex items-baseline justify-between border-t border-[#57534E] pt-[1.4vh]"><span className="font-display text-[2.6vw] font-bold">Ward</span><span className="page-copy">one area</span></div>
        <div className="flex items-baseline justify-between border-t border-[#57534E] pt-[1.4vh]"><span className="font-display text-[2.6vw] font-bold">Villages</span><span className="page-copy">selected</span></div>
        <div className="flex items-baseline justify-between border-t border-[#57534E] pt-[1.4vh]"><span className="font-display text-[2.6vw] font-bold">Constituency</span><span className="page-copy">everyone</span></div>
      </div>
    </PagePanel>
  );
}
