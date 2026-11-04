import portrait from "@assets/ChatGPT_Image_Jun_25,_2026,_01_47_47_PM_1793809540409.png";

export default function Close() {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="panel-stage">
        <main className="page-panel">
          <div className="page-head"><span>JanSetu</span><span>16</span></div>
          <h1 className="mt-[3.4vh] font-display text-[3.4vw] font-bold leading-[1.02] tracking-[-0.035em]">Know every citizen's history. Follow every request through.</h1>
          <p className="page-copy mt-[2vh]">One organised place for voter records, families, requests, visits, works and team follow-up.</p>
          <div className="mt-auto flex items-end gap-[3vh]">
            <img src={portrait} crossOrigin="anonymous" className="h-[34vh] w-[26vh] rounded-[1.6vh] object-cover object-top" alt="Representative" />
            <div className="flex-1">
              <p className="label">Contact</p>
              <p className="mt-[1.4vh] font-display text-[2.8vw] font-bold">8767289541</p>
              <p className="mt-[0.6vh] font-display text-[2.8vw] font-bold">8483888585</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
