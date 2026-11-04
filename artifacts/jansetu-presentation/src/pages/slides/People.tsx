export default function People() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute right-0 top-0 w-[22vh] h-[22vh] bg-primary"></div>
        <div className="absolute right-[4vh] top-[4vh] w-[14vh] h-[14vh] border border-[#5fd0c6]/60 rounded-full"></div>
        <div className="relative pl-[6vh] pr-[26vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-primary" style={{textWrap:"balance"}}>Built around people and their responsibilities</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Citizens and families</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7z"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Representatives and their personal assistants</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Office administrators</p>
          </div>
          <div className="flex items-start gap-[2.4vh] py-[2.4vh] border-t border-primary/20">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.4vh",height:"3.4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h12M12 6l6 6-6 6"/></svg>
            <p className="text-[2.4vh] leading-snug text-text">Staff and field workers</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>04</span></div>
      </div>
    </div>
  );
}
