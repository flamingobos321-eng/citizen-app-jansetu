import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Citizens() {
  return (
    <PagePanel tone="cobalt" eyebrow="THE CITIZEN EXPERIENCE" title="Useful services, in a real mobile app.">
      <div className="mt-[3vh] flex items-center justify-center gap-[4vh]">
        <div className="max-w-[27vh]">
          <p className="page-copy">Sign in by mobile OTP.</p>
          <p className="page-copy mt-[2.8vh]">See issue and service history.</p>
          <p className="page-copy mt-[2.8vh]">Keep household links in view.</p>
        </div>
        <img
          src={`${base}mobile-screens/citizen-home.png`}
          crossOrigin="anonymous"
          className="phone-shot phone-shot--large rounded-[2.4vh]"
          alt="JanSetu mobile app home screen"
        />
      </div>
      <p className="page-detail absolute bottom-[5.5vh] left-[5.2vh]">JanSetu mobile app</p>
    </PagePanel>
  );
}
