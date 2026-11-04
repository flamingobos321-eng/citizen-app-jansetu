const base = import.meta.env.BASE_URL;

export default function Citizens() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[46vh] bg-primary"></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Citizens</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-white" style={{textWrap:"balance"}}>A simpler experience for citizens</h1>
          <div className="mt-[2vh]">
            <div className="flex items-start gap-[1.6vh] py-[0.9vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2.1vh] leading-snug text-white">Report local issues</p></div>
            <div className="flex items-start gap-[1.6vh] py-[0.9vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2.1vh] leading-snug text-white">Follow request progress</p></div>
            <div className="flex items-start gap-[1.6vh] py-[0.9vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2.1vh] leading-snug text-white">View updates and announcements</p></div>
            <div className="flex items-start gap-[1.6vh] py-[0.9vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2.1vh] leading-snug text-white">Access profile and family tools</p></div>
          </div>
          <div className="mt-[3vh]"></div>
          <div className="w-full">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/citizen-dashboard.jpg`} crossOrigin="anonymous" alt="Website screenshot · Demo account; identifying details hidden" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-muted">Website screenshot · Demo account; identifying details hidden</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-muted"><span className="font-display font-semibold">JanSetu</span><span>06</span></div>
      </div>
    </div>
  );
}
