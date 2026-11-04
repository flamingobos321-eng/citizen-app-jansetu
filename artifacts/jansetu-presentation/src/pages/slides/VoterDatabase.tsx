import PagePanel from "../../components/PagePanel";

export default function VoterDatabase() {
  return (
    <PagePanel eyebrow="Constituency Transfer" page="06" title="Constituency transfer keeps the history">
      <p className="page-copy mt-[2.4vh]">A transfer records the new address, area and reason. The person's history moves with them, and every transfer is audited.</p>
      <p className="page-copy mt-[1.6vh]"><strong>Relatives are never moved automatically.</strong></p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Not implied</span><span className="row-val">Live location</span></div>
      </div>
    </PagePanel>
  );
}
