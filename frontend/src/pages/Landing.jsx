import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowRight, ShieldCheck, FileText, Bell, Hammer, BarChart3, MapPin, Users } from "lucide-react";

const HERO_BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="header-logo">
            <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">JS</div>
            <div>
              <div className="font-heading font-bold text-[#0A1128] leading-none text-lg">JANSETU</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-0.5">My Constituency</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/staff/login" data-testid="staff-login-link">
              <Button variant="outline" className="border-gray-300">Staff / Admin</Button>
            </Link>
            <Link to="/citizen/login" data-testid="citizen-login-link">
              <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white">
                Citizen Login <ArrowRight className="ml-2" size={16} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-0">
          <img src={HERO_BG} alt="Government building" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20 sm:py-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 mb-6">
              <ShieldCheck size={14} className="text-[#0A1128]" />
              Official Constituency Service Platform
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.05]">
              Connecting citizens with their <span className="text-[#0A1128]">elected representatives</span>.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-2xl leading-relaxed">
              Raise complaints, track resolution, view development works, and stay informed about your
              constituency — all in one transparent place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/citizen/login" data-testid="cta-citizen">
                <Button size="lg" className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white px-6">
                  Get Started as Citizen <ArrowRight className="ml-2" size={16} />
                </Button>
              </Link>
              <Link to="/staff/login" data-testid="cta-staff">
                <Button size="lg" variant="outline" className="border-gray-300 px-6">
                  Sign in as Staff
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <div>
                <div className="font-heading text-2xl font-bold text-[#0A1128]">12+</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Issue Categories</div>
              </div>
              <div>
                <div className="font-heading text-2xl font-bold text-[#0A1128]">7</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">Workflow Stages</div>
              </div>
              <div>
                <div className="font-heading text-2xl font-bold text-[#0A1128]">5</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">User Roles</div>
              </div>
            </div>
          </div>

          {/* Right info card */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">For Citizens</div>
              <h3 className="font-heading text-2xl font-semibold mt-2 text-gray-900">A direct line to your office.</h3>
              <ul className="mt-5 space-y-3 text-sm text-gray-700">
                {[
                  { icon: FileText, t: "Raise issues with photos & location" },
                  { icon: Bell, t: "Real-time status updates" },
                  { icon: Hammer, t: "View development works in your area" },
                  { icon: MapPin, t: "Politician visit & camp schedules" },
                ].map((x, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <x.icon size={18} className="text-[#0A1128] mt-0.5" />
                    <span>{x.t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-5 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500">Verified by mobile OTP</span>
                <Link to="/citizen/login" className="text-sm font-semibold text-[#0A1128]" data-testid="hero-card-link">
                  Continue →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">Platform</div>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
          Everything an office needs. Nothing it doesn't.
        </h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: FileText, t: "Issue Management", d: "End-to-end workflow from New → Verified, with full audit trail." },
            { icon: Users, t: "Households & Citizens", d: "Lightweight household records — no complex family trees." },
            { icon: BarChart3, t: "Politician Dashboards", d: "Area-wise, ward-wise, and worker performance at a glance." },
            { icon: Bell, t: "Targeted Notifications", d: "Push announcements to wards, villages, or the full constituency." },
            { icon: Hammer, t: "Development Works", d: "Public project tracker with status, budget, and timelines." },
            { icon: ShieldCheck, t: "Role-Based Access", d: "Citizen, Worker, PA, Politician, Admin — each with the right view." },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 hover:border-[#0A1128] transition-colors">
              <f.icon size={22} className="text-[#0A1128]" />
              <h3 className="font-heading text-lg font-semibold mt-4 text-gray-900">{f.t}</h3>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8 text-sm text-gray-500 flex flex-wrap justify-between gap-4">
          <div>© 2026 JANSETU. A constituency management service.</div>
          <div className="flex gap-6">
            <span>Mobile OTP secured</span>
            <span>Government-grade audit trail</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
