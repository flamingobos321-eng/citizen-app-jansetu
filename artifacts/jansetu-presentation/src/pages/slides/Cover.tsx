import portrait from "@assets/ChatGPT_Image_Jun_25,_2026,_01_47_47_PM_1793809540409.png";

const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="panel-stage">
        <main className="page-panel page-panel--dark">
          <div className="page-head">
            <span>Constituency office system</span>
            <span>01</span>
          </div>
          <h1 className="mt-[3vh] font-display text-[5.6vw] font-extrabold leading-[0.9] tracking-[-0.04em]">JANSETU</h1>
          <p className="mt-[2.4vh] font-display text-[2vw] font-semibold leading-[1.15] text-[#F5F3EF]">A mobile-first workspace connecting voter records, citizens, families and constituency-office services.</p>
          <p className="page-copy mt-[2vh]">Who a citizen is, their household, what they asked for, and who is following it up.</p>
          <div className="mt-[2.4vh] flex items-end gap-[2.4vh]">
            <img src={portrait} crossOrigin="anonymous" className="h-[30vh] w-[24vh] rounded-[1.6vh] object-cover object-top" alt="Representative" />
            <img src={`${base}mobile-screens/citizen-home.png`} crossOrigin="anonymous" className="phone-shot h-[30vh]" alt="JanSetu citizen home screen" />
          </div>
          <div className="page-foot">
            <span>Representative</span>
            <span>Citizen home screen</span>
          </div>
        </main>
      </div>
    </div>
  );
}
