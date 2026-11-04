import PagePanel from "../../components/PagePanel";

export default function Reports() {
  return (
    <PagePanel tone="blue" eyebrow="FROM RECORDS TO A WORKING VIEW" title="See what needs attention nearby.">
      <div className="mt-[4vh]">
        <div className="flex items-center justify-between gap-[2vh]">
          <span className="font-display text-[3.3vw] font-bold">Issue MIS</span>
          <span className="page-detail">Status &amp; follow-up</span>
        </div>
        <div className="page-rule my-[1.7vh]" />
        <div className="flex items-center justify-between gap-[2vh]">
          <span className="font-display text-[3.3vw] font-bold">Households</span>
          <span className="page-detail">People &amp; service records</span>
        </div>
        <div className="page-rule my-[1.7vh]" />
        <div className="flex items-center justify-between gap-[2vh]">
          <span className="font-display text-[3.3vw] font-bold">Wards</span>
          <span className="page-detail">Area-level reporting</span>
        </div>
      </div>
      <div className="mt-[3vh] rounded-[2vh] bg-[#2563eb] px-[2.4vh] py-[2vh] text-[#f6f8fc]">
        <p className="font-display text-[2.8vw] font-bold">Export to CSV</p>
        <p className="page-detail mt-[0.8vh] text-[#d8e5ff]">Citizens · households · issues · public works</p>
      </div>
    </PagePanel>
  );
}
