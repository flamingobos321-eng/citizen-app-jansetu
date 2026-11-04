export default function Outreach() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[44vh] bg-accent"></div>
        <div className="relative px-[6vh] pt-[8vh]">
          <div className="h-[0.6vh] w-[9vh] bg-white"></div>
          <h1 className="mt-[2.4vh] font-display font-semibold text-[5.4vh] leading-[1.06] text-white" style={{textWrap:"balance"}}>Coordinate outreach and local work</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] top-[34vh] grid grid-cols-2 gap-[2.4vh]">
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Campaign tools for organised outreach</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Visit records for follow-up</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 4v5c0 5-4 8-8 9-4-1-8-4-8-9V7z"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Development-work tracking</p>
          </div>
          <div className="bg-white px-[2.4vh] py-[2.6vh] shadow-[0_0.6vh_2vh_rgba(15,42,68,0.08)] flex flex-col gap-[1.6vh]">
            <svg viewBox="0 0 24 24" className="text-accent shrink-0" style={{width:"3.6vh",height:"3.6vh"}} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/></svg>
            <p className="text-[2.2vh] leading-snug text-text">Reports for office review</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>11</span></div>
      </div>
    </div>
  );
}
