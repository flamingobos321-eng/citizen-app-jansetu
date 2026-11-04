export default function Staff() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-primary overflow-hidden font-body text-text">
        <div className="absolute right-[-12vh] top-[-12vh] w-[40vh] h-[40vh] rounded-full border border-white/10"></div>
        <div className="relative px-[6vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-white" style={{textWrap:"balance"}}>Support staff in the office and in the field</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh] grid grid-cols-2 gap-x-[4vh] gap-y-[5vh]">
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Access role-appropriate tools</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 7a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Record visits and case progress</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Update work without relying on separate registers</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Keep the office informed through shared records</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-white/60"><span>JanSetu</span><span>09</span></div>
      </div>
    </div>
  );
}
