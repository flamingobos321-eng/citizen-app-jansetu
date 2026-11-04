import representativePortrait from "@assets/ChatGPT_Image_Jun_25,_2026,_01_47_47_PM_1793809540409.png";
import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Cover() {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <div className="panel-stage">
        <main className="page-panel page-panel--navy">
          <div className="page-topline">A clearer view of every constituency</div>
          <h1 className="mt-[3vh] font-display text-[5.1vw] font-bold leading-[0.96] tracking-[-0.05em] text-wrap-balance">
            <span className="block">Local service.</span>
            <span className="block">Connected.</span>
          </h1>
          <p className="page-copy mt-[2vh] max-w-[55vh] text-[#d8e5ff]">
            A practical view of people, requests and follow-through.
          </p>
          <div className="mt-[3vh] flex items-end justify-center gap-[3vh]">
            <div className="flex flex-col items-center gap-[1.4vh]">
              <img
                src={representativePortrait}
                crossOrigin="anonymous"
                className="portrait-image"
                alt="Demo representative portrait"
              />
              <span className="page-detail text-center">Demo representative</span>
            </div>
            <div className="flex flex-col items-center gap-[1.4vh]">
              <img
                src={`${base}mobile-screens/citizen-home.png`}
                crossOrigin="anonymous"
                className="phone-shot phone-shot--compact rounded-[2.4vh]"
                alt="JanSetu mobile app home screen"
              />
              <span className="page-detail text-center">JanSetu mobile app</span>
            </div>
          </div>
          <div className="page-rule absolute bottom-[5.4vh] left-[5.2vh] w-[calc(100%-10.4vh)]" />
        </main>
      </div>
    </div>
  );
}
