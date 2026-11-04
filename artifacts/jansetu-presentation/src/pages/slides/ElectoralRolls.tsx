export default function ElectoralRolls() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-primary overflow-hidden font-body text-text">
        <div className="absolute right-0 top-0 w-[26vh] h-[30vh] bg-accent rounded-bl-[6vh] flex items-center justify-center"><svg viewBox="0 0 24 24" style={{width:"12vh",height:"12vh"}} fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <div className="pr-[24vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Electoral roll imports</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-white" style={{textWrap:"balance"}}>Turn electoral rolls into usable records</h1>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[10vh]">
          <div className="border-t border-white/15">
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">01</span><p className="text-[2.3vh] leading-snug text-white">Upload multiple electoral-roll PDFs</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">02</span><p className="text-[2.3vh] leading-snug text-white">English and Marathi language detection</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">03</span><p className="text-[2.3vh] leading-snug text-white">Import history and processing summaries</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">04</span><p className="text-[2.3vh] leading-snug text-white">Duplicate matching within the office using EPIC</p></div>
            <div className="flex items-start gap-[2.4vh] py-[2.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.6vh] text-accent w-[4vh] shrink-0">05</span><p className="text-[2.3vh] leading-snug text-white">Each voter remains an independent person</p></div>
          </div>
          <p className="mt-[2.4vh] text-[1.7vh] leading-snug text-white/70">Imports support office records; they do not modify the official electoral roll.</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>12</span></div>
      </div>
    </div>
  );
}
