import PagePanel from "../../components/PagePanel";

export default function Reports() {
  return (
    <PagePanel eyebrow="Karyakarta Celebrations" page="12" title="Karyakarta birthdays and anniversaries">
      <p className="page-copy mt-[2.4vh]">A celebrations view lists upcoming karyakarta birthdays and anniversaries, so the office can plan a call or visit in time.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Today</span><span className="row-val">Who to greet</span></div>
        <div className="row"><span className="row-key">This week</span><span className="row-val">Who to plan for</span></div>
      </div>
    </PagePanel>
  );
}
