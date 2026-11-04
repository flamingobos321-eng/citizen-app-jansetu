export default function VisitsWorks() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-primary overflow-hidden font-body text-text">
        <div className="absolute right-0 top-0 w-[26vh] h-[30vh] bg-accent rounded-bl-[6vh] flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"12vh",height:"12vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <div className="pr-[24vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Visits & development work</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-white" style={{textWrap:"balance"}}>Plan visits and track development work</h1>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <div className="border-t border-white/15">
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">01</span><p className="text-[2.3vh] leading-snug text-white">Maintain visit schedules and follow-up records</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">02</span><p className="text-[2.3vh] leading-snug text-white">Track development projects and their progress</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">03</span><p className="text-[2.3vh] leading-snug text-white">Publish selected work and visits on the public portal</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">04</span><p className="text-[2.3vh] leading-snug text-white">Connect relevant benefits with household records</p></div>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>17</span></div>
      </div>
    </div>
  );
}
