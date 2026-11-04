const base = import.meta.env.BASE_URL;

export default function Informed() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[0.8vh] bg-accent"></div>
        <div className="relative px-[6vh] pt-[7vh] flex flex-col">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Updates & notifications</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Keep citizens informed</h1>
          <div className="mt-[2.6vh] flex justify-center">
          <div className="w-[52vh]">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/citizen-profile.jpg`} crossOrigin="anonymous" alt="Website screenshot · Demo account; identifying details hidden · Citizen profile" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-muted">Website screenshot · Demo account; identifying details hidden · Citizen profile</p>
          </div>
          </div>
          <div className="mt-[1.6vh] grid grid-cols-2 gap-x-[3vh] gap-y-[1.8vh]">
            <div className="flex items-start gap-[1.4vh] border-t border-primary/10 pt-[1.4vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Announcements and office updates</p></div>
            <div className="flex items-start gap-[1.4vh] border-t border-primary/10 pt-[1.4vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Issue-progress information</p></div>
            <div className="flex items-start gap-[1.4vh] border-t border-primary/10 pt-[1.4vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">An organised place to check what has changed</p></div>
            <div className="flex items-start gap-[1.4vh] border-t border-primary/10 pt-[1.4vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Less dependence on repeated follow-up calls</p></div>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-muted"><span className="font-display font-semibold">JanSetu</span><span>20</span></div>
      </div>
    </div>
  );
}
