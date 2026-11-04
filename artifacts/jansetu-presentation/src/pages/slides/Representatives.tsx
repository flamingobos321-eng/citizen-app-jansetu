export default function Representatives() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute right-0 top-0 w-[26vh] h-[30vh] bg-accent rounded-bl-[6vh] flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"12vh",height:"12vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <div className="pr-[24vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Representatives & PAs</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Help representatives stay informed</h1>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <div className="border-t border-primary/10">
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-primary/10"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">01</span><p className="text-[2.3vh] leading-snug text-text">Review office activity</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-primary/10"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">02</span><p className="text-[2.3vh] leading-snug text-text">See outstanding citizen concerns</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-primary/10"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">03</span><p className="text-[2.3vh] leading-snug text-text">Follow work recorded by the team</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-primary/10"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">04</span><p className="text-[2.3vh] leading-snug text-text">Use reports to support review meetings</p></div>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-muted"><span className="font-display font-semibold">JanSetu</span><span>09</span></div>
      </div>
    </div>
  );
}
