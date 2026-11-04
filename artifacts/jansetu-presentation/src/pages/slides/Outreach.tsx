import PagePanel from "../../components/PagePanel";

export default function Outreach() {
  return (
    <PagePanel tone="navy" eyebrow="CARE FOR THE PEOPLE WHO SERVE" title="Make sure Karyakarta birthdays are not missed.">
      <div className="mt-[4.5vh]">
        <p className="font-display text-[6.1vw] font-bold leading-[0.94] tracking-[-0.05em] text-[#c9dbff]">
          Remember
          <span className="block text-[#f6f8fc]">the people</span>
          <span className="block text-[#f6f8fc]">by name.</span>
        </p>
        <p className="page-copy mt-[4vh] max-w-[54vh]">
          A celebrations view surfaces upcoming Karyakarta birthdays for office follow-up.
        </p>
      </div>
      <div className="absolute bottom-[5.5vh] left-[5.2vh] right-[5.2vh]">
        <div className="page-rule" />
        <p className="page-detail mt-[1.8vh]">A small operational detail that should not slip through.</p>
      </div>
    </PagePanel>
  );
}
