import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Households() {
  return (
    <PagePanel eyebrow="Development Works" title="Keep development work visible and understandable.">
      <div className="mt-[4vh] flex items-center gap-[4vh]">
        <div className="flex-1">
          <p className="page-copy">Show the project status, location and timeline in a citizen-facing view.</p>
          <p className="page-copy mt-[3vh]">Connect work updates to the local service history and follow-up.</p>
          <p className="page-detail mt-[3vh]">Progress information, not monetary amounts.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-services.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--medium rounded-[2.4vh]"
          alt="JanSetu mobile app local services screen"
        />
      </div>
    </PagePanel>
  );
}
