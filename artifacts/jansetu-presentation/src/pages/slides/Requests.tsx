export default function Requests() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute left-0 top-0 bottom-0 w-[2vh] bg-accent"></div>
        <div className="relative pl-[8vh] pr-[6vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-primary" style={{textWrap:"balance"}}>Every citizen request deserves a clear next step</h1>
          <div className="mt-[4vh] h-[16vh] bg-accent/10 flex items-center px-[3vh]">
            <svg viewBox="0 0 200 60" className="w-full h-[11vh] text-accent" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="20" cy="30" r="9"/><circle cx="100" cy="30" r="14" className="text-primary" stroke="#0f2a44"/><circle cx="180" cy="30" r="9"/><path d="M29 30h57M114 30h57"/><circle cx="60" cy="12" r="5"/><circle cx="140" cy="48" r="5"/><path d="M64 15l26 9M136 45l-24-8"/></svg>
          </div>
        </div>
        <div className="absolute left-[8vh] right-[6vh] bottom-[10vh] border-t border-primary/15">
          <div className="flex items-center gap-[3vh] py-[2.6vh] border-b border-primary/15">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.8vh",height:"3.8vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 7a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Requests arrive through calls, messages and office visits</p>
          </div>
          <div className="flex items-center gap-[3vh] py-[2.6vh] border-b border-primary/15">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.8vh",height:"3.8vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Scattered records make follow-up difficult</p>
          </div>
          <div className="flex items-center gap-[3vh] py-[2.6vh] border-b border-primary/15">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.8vh",height:"3.8vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Teams need clear ownership and a shared view of pending work</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>02</span></div>
      </div>
    </div>
  );
}
