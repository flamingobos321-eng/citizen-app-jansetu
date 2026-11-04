export default function WebMobile() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-primary overflow-hidden font-body text-text">
        <div className="absolute right-[-12vh] top-[-12vh] w-[40vh] h-[40vh] rounded-full border border-white/10"></div>
        <div className="relative px-[6vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-white" style={{textWrap:"balance"}}>Web and mobile, with a shared purpose</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh] grid grid-cols-2 gap-x-[4vh] gap-y-[5vh]">
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7z"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Web workspace for office workflows</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Mobile access for citizens and office roles</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h12M12 6l6 6-6 6"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">One backend connecting requests and updates</p>
          </div>
          <div className="border-t border-white/25 pt-[2.4vh]">
            <svg viewBox="0 0 24 24" className="text-[#5fd0c6] shrink-0" style={{width:"4vh",height:"4vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
            <p className="mt-[2vh] text-[2.3vh] leading-snug text-white">Native-device and role-specific checks remain part of rollout</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-white/60"><span>JanSetu</span><span>13</span></div>
      </div>
    </div>
  );
}
