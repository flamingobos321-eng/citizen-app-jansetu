export default function Resolution() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[36vh] bg-primary"></div>
        <div className="relative px-[6vh] pt-[8vh]">
        <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
        <h1 className="mt-[2.4vh] font-display font-semibold text-[5vh] leading-[1.08] text-white" style={{textWrap:"balance"}}>From request to resolution</h1>
        </div>
        <div className="absolute left-[6vh] right-[6vh] top-[40vh] bottom-[10vh] bg-white shadow-[0_1vh_3vh_rgba(15,42,68,0.12)] px-[4vh] py-[4vh] flex flex-col justify-between">
          <div className="absolute left-[6.6vh] top-[6vh] bottom-[6vh] w-px bg-accent/40"></div>
          <div className="flex items-start gap-[2.4vh]">
            <div className="w-[5.2vh] h-[5.2vh] rounded-full bg-white border border-accent text-accent flex items-center justify-center font-display text-[2.4vh] font-semibold shrink-0 relative z-10">1</div>
            <p className="pt-[1.2vh] text-[2.3vh] leading-snug text-text">A citizen reports an issue</p>
          </div>
          <div className="flex items-start gap-[2.4vh]">
            <div className="w-[5.2vh] h-[5.2vh] rounded-full bg-white border border-accent text-accent flex items-center justify-center font-display text-[2.4vh] font-semibold shrink-0 relative z-10">2</div>
            <p className="pt-[1.2vh] text-[2.3vh] leading-snug text-text">The office reviews and assigns responsibility</p>
          </div>
          <div className="flex items-start gap-[2.4vh]">
            <div className="w-[5.2vh] h-[5.2vh] rounded-full bg-white border border-accent text-accent flex items-center justify-center font-display text-[2.4vh] font-semibold shrink-0 relative z-10">3</div>
            <p className="pt-[1.2vh] text-[2.3vh] leading-snug text-text">Staff record progress</p>
          </div>
          <div className="flex items-start gap-[2.4vh]">
            <div className="w-[5.2vh] h-[5.2vh] rounded-full bg-white border border-accent text-accent flex items-center justify-center font-display text-[2.4vh] font-semibold shrink-0 relative z-10">4</div>
            <p className="pt-[1.2vh] text-[2.3vh] leading-snug text-text">The citizen follows the status</p>
          </div>
          <div className="flex items-start gap-[2.4vh]">
            <div className="w-[5.2vh] h-[5.2vh] rounded-full bg-accent text-white flex items-center justify-center font-display text-[2.4vh] font-semibold shrink-0 relative z-10">5</div>
            <p className="pt-[1.2vh] text-[2.3vh] leading-snug text-text">Closure is recorded when the work is complete</p>
          </div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.6vh] flex justify-between items-center font-body text-[1.5vh] tracking-[0.14em] uppercase text-muted"><span>JanSetu</span><span>06</span></div>
      </div>
    </div>
  );
}
