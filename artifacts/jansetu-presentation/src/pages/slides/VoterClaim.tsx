const base = import.meta.env.BASE_URL;

export default function VoterClaim() {
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#E5E7EB] flex justify-center">
      <div className="relative h-screen w-[70.7070707vh] bg-bg overflow-hidden font-body text-text">
        <div className="absolute inset-x-0 top-0 h-[50vh] bg-accent/10"></div>
        <div className="relative px-[6vh] pt-[7vh]">
          <p className="text-[1.6vh] font-semibold tracking-[0.14em] uppercase text-accent">Voter-record claiming</p>
          <h1 className="mt-[1.4vh] font-display font-semibold text-[4.6vh] leading-[1.08] tracking-tight text-primary" style={{textWrap:"balance"}}>Help citizens find their existing voter record</h1>
          <div className="mt-[3vh] flex justify-center">
<div className="w-[36vh]">
            <div className="rounded-[1.2vh] overflow-hidden bg-white border border-primary/10 shadow-[0_1.2vh_3.6vh_rgba(10,17,40,0.16)]">
              <div className="h-[2.4vh] bg-[#EEF0F3] flex items-center gap-[0.6vh] px-[1.2vh]"><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span><span className="w-[0.9vh] h-[0.9vh] rounded-full bg-[#D1D5DB]"></span></div>
              <img src={`${base}screenshots/voter-claim-detail.jpg`} crossOrigin="anonymous" alt="Website screenshot · Voter-record search" className="block w-full h-auto" />
            </div>
            <p className="mt-[1vh] text-[1.5vh] text-muted">Website screenshot · Voter-record search</p>
          </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-primary px-[6vh] pt-[2vh]">
            <div className="flex items-start gap-[2vh] py-[1.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.4vh] text-accent w-[3.6vh] shrink-0">01</span><p className="text-[2.1vh] leading-snug text-white">Search by name, relative, house number or EPIC</p></div>
            <div className="flex items-start gap-[2vh] py-[1.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.4vh] text-accent w-[3.6vh] shrink-0">02</span><p className="text-[2.1vh] leading-snug text-white">Select the matching imported record</p></div>
            <div className="flex items-start gap-[2vh] py-[1.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.4vh] text-accent w-[3.6vh] shrink-0">03</span><p className="text-[2.1vh] leading-snug text-white">Verify a mobile number through OTP</p></div>
            <div className="flex items-start gap-[2vh] py-[1.2vh] border-b border-white/15"><span className="font-display font-semibold text-[2.4vh] text-accent w-[3.6vh] shrink-0">04</span><p className="text-[2.1vh] leading-snug text-white">Activate access without creating a separate duplicate identity</p></div>
        </div>
        <div className="absolute left-[6vh] right-[6vh] bottom-[3.4vh] flex justify-between items-center text-[1.5vh] tracking-[0.12em] uppercase text-white/60"><span className="font-display font-semibold">JanSetu</span><span>14</span></div>
      </div>
    </div>
  );
}
