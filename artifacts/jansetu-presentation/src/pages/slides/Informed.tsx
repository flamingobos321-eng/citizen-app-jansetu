import PagePanel from "../../components/PagePanel";

const base = import.meta.env.BASE_URL;

export default function Informed() {
  return (
    <PagePanel eyebrow="One mobile app" page="14" title="One app, citizen and office views">
      <p className="page-copy mt-[2vh]">Citizens see profile, family and requests. Office users sign in separately for role tools.</p>
      <div className="mt-auto flex justify-between">
        <div><img src={`${base}mobile-screens/citizen-profile.png`} crossOrigin="anonymous" className="phone-shot h-[42vh]" alt="Citizen profile screen" /><p className="page-detail mt-[1vh]">Citizen profile</p></div>
        <div><img src={`${base}mobile-screens/office-signin.png`} crossOrigin="anonymous" className="phone-shot h-[42vh]" alt="Office sign-in screen" /><p className="page-detail mt-[1vh]">Office sign-in</p></div>
      </div>
    </PagePanel>
  );
}
