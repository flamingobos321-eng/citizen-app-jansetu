export default function Representatives() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute right-0 top-0 w-[22vh] h-[22vh] bg-primary"></div>
        <div className="absolute right-[4vh] top-[4vh] w-[14vh] h-[14vh] border border-[#5fd0c6]/60 rounded-full"></div>
        <div className="relative pl-[6vh] pr-[26vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-primary" style={{textWrap:"balance"}}>Help representatives stay informed</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Review office activity</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">See outstanding citizen concerns</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 7a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Follow work recorded by the team</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Use reports to support review meetings</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>08</span></div>
      </div>
    </div>
  );
}
