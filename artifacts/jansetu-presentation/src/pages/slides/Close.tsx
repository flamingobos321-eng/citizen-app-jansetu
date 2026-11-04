import PagePanel from "../../components/PagePanel";

export default function Close() {
  return (
    <PagePanel tone="cobalt" eyebrow="JANSETU" title="Bring the constituency view together.">
      <p className="page-copy mt-[4vh] max-w-[55vh]">
        People. Households. Requests. Local work. A clearer path from record to follow-through.
      </p>
      <div className="mt-[9vh]">
        <p className="page-detail text-[#d8e5ff]">CONNECT WITH THE JANSETU TEAM</p>
        <p className="mt-[2vh] font-display text-[4.2vw] font-bold tracking-[-0.04em]">8767289541</p>
        <p className="mt-[1.5vh] font-display text-[4.2vw] font-bold tracking-[-0.04em]">8483888585</p>
      </div>
      <div className="absolute bottom-[5.5vh] left-[5.2vh] right-[5.2vh]">
        <div className="page-rule" />
        <p className="page-detail mt-[1.8vh]">Constituency services, organized around people.</p>
      </div>
    </PagePanel>
  );
}
