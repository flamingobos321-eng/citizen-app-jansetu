const base = import.meta.env.BASE_URL;

export default function Families() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[0.8vh] bg-accent"></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Family linking</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Families remain connected</h1>
          <div className="mt-[3vh] flex gap-[3vh] items-start">
<div className="w-[30vh] shrink-0">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/family-dialog.jpg`} crossOrigin="anonymous" alt="Website screenshot · Demo account; identifying details hidden" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-muted">Website screenshot · Demo account; identifying details hidden</p>
          </div>
            <div className="flex-1">
            <div className="flex items-start gap-[1.6vh] py-[1vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Access household and family tools</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Manage family relationships</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Keep each person’s service records tied to their constituency</p></div>
            <div className="flex items-start gap-[1.6vh] py-[1vh]"><span className="mt-[0.5vh] shrink-0 w-[2.2vh] h-[2.2vh] rounded-full bg-accent flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"1.4vh",height:"1.4vh"}} fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4 10-10"/></svg></span><p className="text-[2vh] leading-snug text-text">Family links can span constituencies</p></div>
            </div>
          </div>
          <div className="mt-[2.6vh] rounded-[2vh] bg-primary px-[3vh] py-[2.6vh]">
            <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Consent-based linking</p>
            <div className="mt-[1.6vh] flex gap-[1vh] flex-wrap"><span className="px-[1.6vh] py-[0.8vh] rounded-full bg-white text-primary text-[1.8vh] font-semibold">Invite</span><span className="px-[1.6vh] py-[0.8vh] rounded-full bg-accent text-white text-[1.8vh] font-semibold">Approve</span><span className="px-[1.6vh] py-[0.8vh] rounded-full bg-white/15 text-white text-[1.8vh] font-semibold">Decline</span><span className="px-[1.6vh] py-[0.8vh] rounded-full bg-white/15 text-white text-[1.8vh] font-semibold">Cancel</span></div>
            <p className="mt-[1.8vh] text-[2vh] leading-snug text-white">Explicit invitations, including links across constituencies.</p>
            <p className="mt-[1vh] text-[1.8vh] leading-snug text-white/70">Relationships are never inferred from voter rolls, and relatives are never transferred automatically.</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-muted"><span className="font-display font-semibold">JanSetu</span><span>15</span></div>
      </div>
    </div>
  );
}
