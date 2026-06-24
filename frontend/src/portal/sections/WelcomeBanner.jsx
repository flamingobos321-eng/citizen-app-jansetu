import { fileUrl } from "../../lib/api";

export default function WelcomeBanner({ config }) {
  return (
    <section className="portal-bg-primary" data-testid="portal-welcome">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid md:grid-cols-5 gap-10 items-center">
        <div className="md:col-span-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold uppercase tracking-widest">{config.constituency_name}</div>
          <h1 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight mt-4 leading-tight">{config.politician_name}</h1>
          <div className="text-sm sm:text-base opacity-80 mt-1">{config.designation}</div>
          {config.welcome_message && (
            <p className="text-base sm:text-lg opacity-90 mt-6 max-w-2xl leading-relaxed">{config.welcome_message}</p>
          )}
          {config.tagline && <div className="mt-5 font-heading italic opacity-80">&ldquo;{config.tagline}&rdquo;</div>}
        </div>
        <div className="md:col-span-2 hidden md:flex justify-end">
          <div className="w-56 h-56 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden ring-1 ring-white/20">
            {config.hero_image_path ? (
              <img src={fileUrl(config.hero_image_path)} alt="" className="w-full h-full object-cover" />
            ) : config.logo_path ? (
              <img src={fileUrl(config.logo_path)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="font-heading text-7xl font-bold opacity-30">{(config.politician_name || "P").charAt(0)}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
