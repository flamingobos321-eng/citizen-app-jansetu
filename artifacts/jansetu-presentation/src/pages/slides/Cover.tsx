const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 bottom-0 h-[52vh] bg-primary"></div>
        <div className="relative px-[6vh] pt-[8vh]">
          <div className="flex items-center gap-[1.4vh]"><span className="w-[4.4vh] h-[4.4vh] rounded-[1.2vh] bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"3vh",height:"3vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M16 5a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg></span><span className="font-display font-semibold text-[2.6vh] text-primary">JanSetu</span></div>
          <h1 className="mt-[4vh] font-display font-bold text-[11vh] leading-[0.95] tracking-tight text-primary">JanSetu</h1>
          <p className="mt-[2vh] font-display text-[3.2vh] leading-tight text-primary" style={{textWrap:"balance"}}>Connecting citizens. <span className="text-accent font-semibold">Supporting representatives.</span></p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] top-[37vh] flex justify-center">
<div className="w-[50vh]">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/website-home.jpg`} crossOrigin="anonymous" alt="Website screenshot" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-white/60">Website screenshot</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[9vh]">
          <p className="text-[2.6vh] leading-snug text-white font-semibold" style={{textWrap:"balance"}}>A connected workspace for constituency services.</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>01</span></div>
      </div>
    </div>
  );
}
