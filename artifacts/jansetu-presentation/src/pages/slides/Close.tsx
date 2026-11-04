export default function Close() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[62vh] bg-primary"></div>
        <div className="absolute right-[-10vh] top-[8vh] w-[36vh] h-[36vh] rounded-full border border-[#5fd0c6]/30"></div>
        <div className="relative px-[6vh] pt-[10vh]">
          <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
          <h1 className="mt-[3vh] font-display font-semibold text-[6.4vh] leading-[1.05] text-white" style={{textWrap:"balance"}}>Bring your constituency office together</h1>
          <p className="mt-[3.6vh] text-[2.6vh] leading-snug text-white/85" style={{textWrap:"pretty"}}>A clearer way to receive requests, coordinate teams and keep citizens informed.</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] top-[68vh] flex flex-col gap-[2.4vh]">
          <div className="flex items-center gap-[2.4vh] border-b border-primary/15 pb-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/></svg>
            <p className="font-display text-[4.2vh] font-semibold text-primary tracking-wide">8767289541</p>
          </div>
          <div className="flex items-center gap-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/></svg>
            <p className="font-display text-[4.2vh] font-semibold text-primary tracking-wide">8483888585</p>
          </div>
        </div>
        <div className="absolute left-[6vh] bottom-[4vh] font-display text-[2.6vh] font-semibold text-accent">JanSetu</div>
      </div>
    </div>
  );
}
