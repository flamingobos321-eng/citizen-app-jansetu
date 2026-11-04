const base = import.meta.env.BASE_URL;

export default function Resolution() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[0.8vh] bg-accent"></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Issue workflow</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>From request to resolution</h1>
          <div className="mt-[3vh] flex gap-[3vh] items-start">
<div className="w-[34vh] shrink-0">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/report-issue.jpg`} crossOrigin="anonymous" alt="Website screenshot · Demo account; identifying details hidden" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-muted">Website screenshot · Demo account; identifying details hidden</p>
          </div>
            <div className="flex-1 flex flex-col gap-[2.4vh] pt-[1vh]">
            <div className="flex items-start gap-[1.4vh]"><span className="shrink-0 w-[3.4vh] h-[3.4vh] rounded-full bg-accent text-white font-display font-semibold text-[1.7vh] flex items-center justify-center">1</span><p className="pt-[0.4vh] text-[2vh] leading-snug text-text">A citizen reports an issue</p></div>
            <div className="flex items-start gap-[1.4vh]"><span className="shrink-0 w-[3.4vh] h-[3.4vh] rounded-full bg-primary text-white font-display font-semibold text-[1.7vh] flex items-center justify-center">2</span><p className="pt-[0.4vh] text-[2vh] leading-snug text-text">The office reviews and assigns responsibility</p></div>
            <div className="flex items-start gap-[1.4vh]"><span className="shrink-0 w-[3.4vh] h-[3.4vh] rounded-full bg-primary text-white font-display font-semibold text-[1.7vh] flex items-center justify-center">3</span><p className="pt-[0.4vh] text-[2vh] leading-snug text-text">Staff record progress</p></div>
            <div className="flex items-start gap-[1.4vh]"><span className="shrink-0 w-[3.4vh] h-[3.4vh] rounded-full bg-primary text-white font-display font-semibold text-[1.7vh] flex items-center justify-center">4</span><p className="pt-[0.4vh] text-[2vh] leading-snug text-text">The citizen follows the status</p></div>
            <div className="flex items-start gap-[1.4vh]"><span className="shrink-0 w-[3.4vh] h-[3.4vh] rounded-full bg-accent text-white font-display font-semibold text-[1.7vh] flex items-center justify-center">5</span><p className="pt-[0.4vh] text-[2vh] leading-snug text-text">Closure is recorded when the work is complete</p></div>
            </div>
          </div>
          <div className="mt-[3.4vh] h-[13vh] rounded-[2vh] bg-primary flex items-center px-[3vh] gap-[2.4vh]"><svg viewBox="0 0 24 24" style={{width:"5vh",height:"5vh"}} fill="none" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></svg><p className="text-[2.2vh] leading-snug text-white font-medium">One shared record from the first report to recorded closure</p></div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-muted"><span className="font-display font-semibold">JanSetu</span><span>07</span></div>
      </div>
    </div>
  );
}
