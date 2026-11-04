export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#d9dfe3] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 bottom-0 h-[46vh] bg-primary"></div>
        <svg viewBox="0 0 400 200" className="absolute left-0 right-0 bottom-[46vh] w-full h-[15vh] text-primary" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M20 200V120h50v80M80 200V90h70v110M160 200V60l50-30 50 30v140M270 200V100h60v100M340 200V130h40v70"/><path d="M190 200v-50h40v50M95 110h40M95 135h40M95 160h40M285 120h30M285 145h30M285 170h30M180 85h60M180 110h60"/><path d="M0 200h400" stroke="#12827c" strokeWidth="2"/></svg>
        <div className="relative px-[6vh] pt-[9vh]">
          <div className="h-[0.6vh] w-[9vh] bg-accent"></div>
          <h1 className="mt-[3vh] font-display font-semibold text-[13vh] leading-none text-primary">JanSetu</h1>
          <p className="mt-[2.4vh] font-display text-[3.4vh] leading-tight text-primary" style={{textWrap:"balance"}}>Connecting citizens. Supporting representatives.</p>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[12vh]">
          <div className="h-[0.4vh] w-[6vh] bg-[#5fd0c6]"></div>
          <p className="mt-[2.4vh] text-[2.8vh] leading-snug text-white font-semibold" style={{textWrap:"balance"}}>A connected workspace for constituency services.</p>
        </div>
        <div className="absolute left-[6vh] bottom-[4vh] text-[1.5vh] tracking-[0.14em] uppercase text-white/60">Constituency services</div>
      </div>
    </div>
  );
}
