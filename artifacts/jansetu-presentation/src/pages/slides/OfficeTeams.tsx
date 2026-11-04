export default function OfficeTeams() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[44vh] bg-accent"></div>
        <div className="relative px-[6vh] pt-[8vh]">
          <div className="h-[0.6vh] w-[9vh] bg-white"></div>
          <h1 className="mt-[2.4vh] font-display font-semibold text-[5.4vh] leading-[1.06] text-white" style={{textWrap:"balance"}}>Give office teams a clearer working day</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] top-[34vh] grid grid-cols-2 gap-[2.4vh]">
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h12M12 6l6 6-6 6"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">View incoming and pending issues</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Find cases by keyword and status</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Coordinate responsibility across the team</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 7a3 3 0 010 6M21 19c0-2-1-4-3-4.5"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Keep progress updates with the case</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>07</span></div>
      </div>
    </div>
  );
}
