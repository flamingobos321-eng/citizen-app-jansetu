import PagePanel from "../../components/PagePanel";

export default function Requests() {
  return (
    <PagePanel tone="blue" eyebrow="THE DAY-TO-DAY CHALLENGE" title="A constituency is more than a request queue.">
      <p className="page-copy mt-[2vh]">
        Records, conversations and memory fragment follow-up.
      </p>
      <div className="mt-[3vh] space-y-[1.5vh]">
        <div>
          <p className="font-display text-[3.2vw] font-bold tracking-[-0.04em] text-accent">People</p>
          <p className="page-copy">Who asked — and what came before?</p>
        </div>
        <div className="page-rule" />
        <div>
          <p className="font-display text-[3.2vw] font-bold tracking-[-0.04em] text-accent">Ownership</p>
          <p className="page-copy">Who has the next step?</p>
        </div>
        <div className="page-rule" />
        <div>
          <p className="font-display text-[3.2vw] font-bold tracking-[-0.04em] text-accent">Follow-through</p>
          <p className="page-copy">What happened, and where?</p>
        </div>
      </div>
    </PagePanel>
  );
}
