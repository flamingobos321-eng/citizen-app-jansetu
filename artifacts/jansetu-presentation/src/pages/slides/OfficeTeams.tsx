export default function OfficeTeams() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Office teams</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Give office teams a clearer working day</h1>
        </div>
        <div className="absolute left-[6vh] top-[27vh] w-[14vh] h-[14vh] rounded-[3vh] bg-primary flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"8vh",height:"8vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg></div>
        <div className="absolute inset-x-0 bottom-0 h-[52vh] bg-accent rounded-tl-[8vh] px-[6vh] pt-[5vh]">
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">View incoming and pending issues</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Find cases by keyword and status</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Coordinate responsibility across the team</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Keep progress updates with the case</p></div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>08</span></div>
      </div>
    </div>
  );
}
