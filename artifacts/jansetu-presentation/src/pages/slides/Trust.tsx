import PagePanel from "../../components/PagePanel";

export default function Trust() {
  return (
    <PagePanel tone="dark" eyebrow="Multi-Tenant Portal" page="15" title="Multi-tenant portal and role-based access">
      <p className="page-copy mt-[2.4vh]">Each representative gets a dedicated, branded portal. Constituency data stays separate, and each role sees only what its work needs.</p>
      <div className="mt-auto">
        <div className="row"><span className="row-key">Identity</span><span className="row-val">Own portal, branding</span></div>
        <div className="row"><span className="row-key">Isolation</span><span className="row-val">Data per office</span></div>
        <div className="row"><span className="row-key">Access</span><span className="row-val">Role-based</span></div>
      </div>
    </PagePanel>
  );
}
