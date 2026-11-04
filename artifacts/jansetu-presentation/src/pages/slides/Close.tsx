export default function Close() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-primary overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-accent rounded-tl-[10vh]"></div>
        <div className="relative px-[6vh] pt-[10vh]">
          <div className="flex items-center gap-[1.4vh]"><span className="w-[4.4vh] h-[4.4vh] rounded-[1.2vh] bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"3vh",height:"3vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M16 5a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg></span><span className="font-display font-semibold text-[2.6vh] text-white">JanSetu</span></div>
          <h1 className="mt-[5vh] font-display font-bold text-[6.4vh] leading-[1.02] tracking-tight text-white" style={{textWrap:"balance"}}>Bring your constituency office together</h1>
          <p className="mt-[3vh] text-[2.4vh] leading-snug text-white/80" style={{textWrap:"pretty"}}>A clearer way to receive requests, coordinate teams and keep citizens informed.</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-primary">Contact</p>
          <p className="mt-[1.6vh] font-display font-semibold text-[5vh] leading-tight text-white">8767289541</p>
          <p className="mt-[0.6vh] font-display font-semibold text-[5vh] leading-tight text-white">8483888585</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-primary"><span className="font-display font-semibold">JanSetu</span><span>24</span></div>
      </div>
    </div>
  );
}
