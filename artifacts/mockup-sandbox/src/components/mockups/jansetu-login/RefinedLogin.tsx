import './_group.css';

export function RefinedLogin() {
  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#f4efe5] px-5 py-7 font-['Manrope'] text-[#12213b]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-[310px] w-[310px] rounded-full bg-[#e8d9bc] opacity-50" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-[290px] w-[290px] rounded-full bg-[#dfe8d0] opacity-70" />

      <div className="relative z-10 w-full max-w-[390px]">
        <header className="mb-8 flex items-center gap-3">
          <img
            src="/__mockup/images/jansetu-icon.png"
            alt="JanSetu civic connection mark"
            className="h-[50px] w-[50px] rounded-[14px] shadow-[0_5px_14px_rgba(18,33,59,0.12)]"
          />
          <div>
            <div className="font-['Outfit'] text-[18px] font-bold tracking-[1.15px] text-[#102345]">
              JANSETU
            </div>
            <div className="mt-0.5 text-[11px] font-semibold tracking-[0.15px] text-[#647083]">
              Your local office, connected
            </div>
          </div>
          <div className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#d6d2c7] bg-[#fbf8f1]" aria-label="Secure sign in">
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] text-[#49654b]" fill="none" aria-hidden="true">
              <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="14.5" r="1" fill="currentColor" />
            </svg>
          </div>
        </header>

        <section className="relative mb-6 overflow-hidden rounded-[24px] bg-[#122a50] px-6 pb-6 pt-6 text-[#fff8e9] shadow-[0_16px_34px_rgba(18,33,59,0.16)]">
          <div className="absolute -right-7 -top-10 h-40 w-40 rounded-full border border-[#f6e9c9]/15" aria-hidden="true" />
          <div className="absolute -right-1 top-1 h-28 w-28 rounded-full border border-[#f6e9c9]/15" aria-hidden="true" />
          <div className="relative max-w-[290px]">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f6e9c9]/20 bg-[#fff8e9]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.15px] text-[#f2c875]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f2c875]" />
              Start with your constituency
            </div>
            <h1 className="font-['Outfit'] text-[30px] font-bold leading-[1.08] tracking-[-0.55px]">
              A clear path to your local office.
            </h1>
            <p className="mt-3 max-w-[270px] text-[13px] leading-[20px] text-[#d8e0ed]">
              Choose the right constituency first, then follow civic issues and office updates in one place.
            </p>
          </div>
          <div className="relative mt-5 flex items-center gap-2 text-[10px] font-semibold tracking-[0.35px] text-[#d8e0ed]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f2c875] text-[10px] font-extrabold text-[#122a50]">1</span>
            <span>Find your office</span>
            <span className="mx-1 h-px w-5 bg-[#fff8e9]/35" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#8fa27d]" />
            <span>Connect with your community</span>
          </div>
        </section>

        <section className="rounded-[22px] border border-[#e2ddd2] bg-[#fffdf8] p-5 shadow-[0_10px_26px_rgba(50,54,52,0.07)]">
          <div className="mb-5">
            <div className="text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#71806c]">Office sign-in</div>
            <h2 className="mt-1.5 font-['Outfit'] text-[21px] font-bold leading-7 text-[#172743]">Where should we connect you?</h2>
            <p className="mt-1 text-[12px] leading-[18px] text-[#687487]">Use the code shared by your local constituency office.</p>
          </div>

          <label htmlFor="office-code" className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.9px] text-[#39465a]">
            Office code
          </label>
          <div className="relative">
            <input
              id="office-code"
              type="text"
              placeholder="For example, JS1045"
              aria-label="Office code"
              autoCapitalize="characters"
              autoComplete="off"
              className="h-[56px] w-full rounded-[12px] border border-[#c9cfc8] bg-[#fbfaf5] px-[15px] pr-12 font-['Manrope'] text-[15px] font-semibold tracking-[0.3px] text-[#172743] outline-none transition focus:border-[#526d52] focus:ring-4 focus:ring-[#526d52]/15 placeholder:font-medium placeholder:tracking-normal placeholder:text-[#88909b]"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-extrabold tracking-[1px] text-[#8a927f]">CODE</span>
          </div>
          <p className="mt-2 flex items-start gap-2 text-[11px] leading-[16px] text-[#6f7987]">
            <svg viewBox="0 0 20 20" className="mt-px h-3.5 w-3.5 shrink-0 text-[#78876f]" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 9v4M10 6.5h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Not sure where to find it? Ask your local office for its JanSetu code.
          </p>
          <button
            type="button"
            className="mt-5 flex h-[54px] w-full items-center justify-center gap-3 rounded-[12px] bg-[#d8912c] px-5 font-['Manrope'] text-[14px] font-extrabold tracking-[0.1px] text-[#172743] shadow-[0_5px_0_#b97721] transition hover:bg-[#e3a13e] active:translate-y-[2px] active:shadow-[0_3px_0_#b97721] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d8912c]/30"
          >
            Continue
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
              <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        <footer className="mt-5 flex items-start justify-center gap-2 px-2 text-center text-[11px] leading-[17px] text-[#687487]">
          <svg viewBox="0 0 20 20" className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#526d52]" fill="none" aria-hidden="true">
            <path d="M10 2.5 16 5v4.4c0 3.7-2.5 6.5-6 8.1-3.5-1.6-6-4.4-6-8.1V5l6-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="m7.5 9.9 1.7 1.7 3.5-3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Your number is used only to verify your citizen account.</span>
        </footer>
        <div className="mt-5 text-center text-[10px] font-semibold tracking-[0.35px] text-[#9a9c96]">A direct connection to your constituency office</div>
      </div>
    </main>
  );
}
