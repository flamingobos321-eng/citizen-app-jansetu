import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function ElectoralRolls() {
  return (
    <PagePanel tone="cobalt" eyebrow="START WITH A USEFUL RECORD" title="Build the citizen record once.">
      <p className="page-copy mt-[3vh]">
        Separate person records from electoral PDFs. English / Marathi detection; office + EPIC dedupe.
      </p>
      <p className="page-copy mt-[2vh]">
        Find by name, relative, house or EPIC. Verify their best current mobile by OTP.
      </p>
      <div className="mt-[2.5vh] flex justify-center">
        <img
          src={`${base}mobile-screens/citizen-profile.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--short rounded-[2.4vh]"
          alt="JanSetu mobile app citizen profile screen"
        />
      </div>
      <p className="page-detail absolute bottom-[5.5vh] left-[5.2vh]">Record activation is citizen-led and mobile-verified.</p>
    </PagePanel>
  );
}
