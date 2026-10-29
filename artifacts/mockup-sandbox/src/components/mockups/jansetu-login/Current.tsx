import './_group.css';

export function Current() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#F9FAFB] px-[22px] py-7 font-['Manrope'] text-[#111827]">
      <div className="w-full max-w-[390px]">
        <div className="mb-[37px] flex items-center gap-3">
          <img
            src="/__mockup/images/jansetu-icon.png"
            alt="JanSetu"
            className="h-12 w-12 rounded-[12px]"
          />
          <div>
            <div className="font-['Outfit'] text-[18px] font-bold tracking-[1.1px] text-[#0A1128]">
              JANSETU
            </div>
            <div className="mt-0.5 text-[11px] font-medium text-[#64748B]">
              Citizen services
            </div>
          </div>
        </div>

        <section className="mb-[23px]">
          <div className="mb-2 text-[10px] font-bold tracking-[1.2px] text-[#64748B]">
            YOUR LOCAL OFFICE, CONNECTED
          </div>
          <h1 className="font-['Outfit'] text-[31px] font-bold leading-[37px]">
            Welcome to JanSetu
          </h1>
          <p className="mt-2 text-[14px] leading-[21px] text-[#64748B]">
            Enter your office code to access the right constituency services.
          </p>
        </section>

        <section className="rounded-[18px] border border-[#E5E7EB] bg-white p-[18px]">
          <label
            htmlFor="office-code"
            className="mb-2 block text-[11px] font-bold uppercase tracking-[0.9px] text-[#64748B]"
          >
            Office code
          </label>
          <input
            id="office-code"
            placeholder="For example, JS1045"
            readOnly
            className="h-[52px] w-full rounded-[10px] border border-[#D1D5DB] bg-white px-[14px] text-[15px] text-[#111827] placeholder:text-[#64748B]"
          />
          <button
            type="button"
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-3 rounded-[10px] bg-[#0A1128] font-['Manrope'] text-[14px] font-bold text-white"
          >
            <span aria-hidden="true">→</span>
            Continue
          </button>
        </section>

        <div className="mt-[18px] flex items-center justify-center gap-2 text-center text-[11px] text-[#64748B]">
          <span aria-hidden="true">⌑</span>
          <span>Your number is used only to verify your citizen account.</span>
        </div>
      </div>
    </main>
  );
}
