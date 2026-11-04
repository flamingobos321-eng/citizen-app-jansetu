export default function OfficeSetup() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Administration</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Configure the office around its responsibilities</h1>
        </div>
        <div className="absolute left-[6vh] top-[27vh] w-[14vh] h-[14vh] rounded-[3vh] bg-primary flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"8vh",height:"8vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg></div>
        <div className="absolute inset-x-0 bottom-0 h-[52vh] bg-accent rounded-tl-[8vh] px-[6vh] pt-[5vh]">
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Manage staff and karyakarta records</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Organise local areas and issue categories</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Control role-appropriate access</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1.8vh] border-b border-white/30"><span className="mt-[0.9vh] shrink-0 w-[1.2vh] h-[1.2vh] rounded-full bg-white"></span><p className="text-[2.3vh] leading-snug text-white font-medium">Maintain office portals through platform administration</p></div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>11</span></div>
      </div>
    </div>
  );
}
