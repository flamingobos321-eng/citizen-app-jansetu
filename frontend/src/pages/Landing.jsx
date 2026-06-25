import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  ArrowRight, ShieldCheck, FileText, Bell, Hammer, BarChart3, MapPin, Users,
  Home, GitMerge, UserCheck, Calendar, ClipboardList, Building2, Globe2,
  Lock, History, ArrowRightLeft, Network, ShieldAlert, CheckCircle2, Star,
  Plus, Minus, BookOpen, Briefcase, Vote, Sparkles, Activity, Layers,
} from "lucide-react";

const HERO_BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

// ---------- Animated number counter ----------
function useCountUp(target, ms = 1400) {
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / ms);
        setN(Math.floor(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
        else setN(target);
      };
      requestAnimationFrame(tick);
      obs.disconnect();
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, ms]);
  return [n, ref];
}

function Counter({ value, suffix = "", label, sublabel }) {
  const [n, ref] = useCountUp(value);
  return (
    <div ref={ref} className="rounded-lg border border-gray-200 bg-white p-6 text-center">
      <div className="font-heading text-4xl sm:text-5xl font-bold text-[#0A1128] tracking-tight">
        {n.toLocaleString()}{suffix}
      </div>
      <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500 mt-2">{label}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
    </div>
  );
}

function FAQ({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
        data-testid={`faq-toggle-${q.slice(0, 16).toLowerCase().replace(/\W+/g, "-")}`}
      >
        <span className="font-heading font-semibold text-gray-900 text-base">{q}</span>
        {open ? <Minus size={16} className="text-gray-500 shrink-0" /> : <Plus size={16} className="text-gray-500 shrink-0" />}
      </button>
      {open && <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">{a}</div>}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* ============= HEADER ============= */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="header-logo">
            <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">JS</div>
            <div>
              <div className="font-heading font-bold text-[#0A1128] leading-none text-lg">JANSETU</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-0.5">My Constituency</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-[#0A1128]">Platform</a>
            <a href="#why" className="hover:text-[#0A1128]">Why JanSetu</a>
            <a href="#how" className="hover:text-[#0A1128]">How it works</a>
            <a href="#faq" className="hover:text-[#0A1128]">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/staff/login" data-testid="staff-login-link">
              <Button variant="outline" className="border-gray-300 hidden sm:inline-flex">Staff / Admin</Button>
            </Link>
            <a href="#cta" data-testid="header-book-demo">
              <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white">
                Book Demo <ArrowRight className="ml-2" size={16} />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ============= HERO ============= */}
      <section className="relative overflow-hidden min-h-screen flex items-center">
        <div className="absolute inset-0 -z-0">
          <img src={HERO_BG} alt="Government building" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
        </div>
        <div className="relative w-full max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 mb-6" data-testid="hero-badge">
              <ShieldCheck size={14} className="text-[#0A1128]" />
              Official Constituency Service Platform
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-[1.05]" data-testid="hero-headline">
              One platform to run your <span className="text-[#0A1128]">entire constituency</span>.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-gray-600 max-w-xl leading-relaxed">
              For MLAs, MPs, Corporators and political offices — manage citizens, complaints, development works and visits from one secure platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#cta" data-testid="hero-book-demo">
                <Button size="lg" className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white px-6">
                  Book Demo <ArrowRight className="ml-2" size={16} />
                </Button>
              </a>
              <Link to="/citizen/login" data-testid="hero-login-portal">
                <Button size="lg" variant="outline" className="border-gray-300 px-6">
                  Login to Portal
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md" data-testid="hero-stats">
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
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">For Constituency Offices</div>
              <h3 className="font-heading text-2xl font-semibold mt-2 text-gray-900">Everything your office needs.</h3>
              <ul className="mt-5 space-y-3 text-sm text-gray-700">
                {[
                  "Citizen CRM",
                  "Complaint Management",
                  "Household & Family Records",
                  "Development Works",
                  "Person 360 History",
                  "Staff & Worker Management",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-[#0A1128] mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 pt-5 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500">Secure Multi-Tenant Platform</span>
                <a href="#features" className="text-sm font-semibold text-[#0A1128]" data-testid="hero-card-link">
                  Learn More →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============= TRUSTED FOR ============= */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Trusted For</div>
            <h3 className="font-heading text-xl sm:text-2xl font-bold text-gray-900 mt-2">
              Built for every elected office and political organisation
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Vote, t: "MLA Offices" },
              { icon: Briefcase, t: "MP Offices" },
              { icon: UserCheck, t: "Corporators" },
              { icon: Building2, t: "Municipal Corporations" },
              { icon: Globe2, t: "Zilla Parishads" },
              { icon: Home, t: "Panchayats" },
              { icon: Network, t: "Political Parties" },
              { icon: Activity, t: "Election War Rooms" },
            ].map((x) => (
              <div key={x.t} className="border border-gray-200 rounded-lg p-4 flex items-center gap-3 hover:border-[#0A1128] transition-colors">
                <div className="w-9 h-9 rounded-md bg-[#0A1128]/5 text-[#0A1128] flex items-center justify-center">
                  <x.icon size={16} />
                </div>
                <div className="font-semibold text-sm text-gray-900">{x.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============= FEATURES ============= */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platform</div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
            Complete Constituency Management Platform
          </h2>
          <p className="text-gray-600 mt-3">
            Every workflow your office runs today — modernised in one secure, role-based platform.
          </p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: Users, t: "Citizen CRM", d: "Unified citizen profiles with mobile-OTP login, contact history, and per-constituency context." },
            { icon: Home, t: "Household Management", d: "Auto-grouped family records by address, with family-head, members, and lineage." },
            { icon: GitMerge, t: "Family Relationships", d: "Father, mother, spouse, sibling links that travel with the citizen across constituencies." },
            { icon: History, t: "Person 360", d: "Lifetime timeline: registrations, complaints, visits, devworks, transfers — all in one view." },
            { icon: FileText, t: "Issue Management", d: "End-to-end workflow from New → Verified with reassignment, SLA tracking and citizen ratings." },
            { icon: Hammer, t: "Development Works", d: "Track public projects with status, budget, location and completion timelines." },
            { icon: Calendar, t: "Visit Management", d: "Schedule MLA visits, health camps and ward inspections with auto-notifications." },
            { icon: Bell, t: "Targeted Notifications", d: "Push announcements to specific wards, villages or the full constituency." },
            { icon: UserCheck, t: "Staff & Worker Management", d: "Role-scoped accounts: workers, PAs, politicians and admins — each with the right access." },
            { icon: BarChart3, t: "Reports & Analytics", d: "Issue MIS, household exports, ward-wise breakdowns and one-click CSV reports." },
            { icon: ArrowRightLeft, t: "Constituency Transfer", d: "Move citizens between constituencies without losing history — one Person, full audit trail." },
            { icon: Layers, t: "Multi-Tenant Portal", d: "Branded portals per constituency with isolated data, themes, and politician identity." },
            { icon: Lock, t: "Role-Based Access", d: "Citizen, Worker, PA, Politician and Admin — each with scoped visibility and write rights." },
          ].map((f) => (
            <div key={f.t} className="bg-white border border-gray-200 rounded-lg p-6 hover:border-[#0A1128] hover:shadow-md transition-all duration-200" data-testid={`feature-${f.t.toLowerCase().replace(/\W+/g, "-")}`}>
              <div className="w-10 h-10 rounded-md bg-[#0A1128]/5 text-[#0A1128] flex items-center justify-center mb-4">
                <f.icon size={18} />
              </div>
              <h3 className="font-heading text-base font-semibold text-gray-900">{f.t}</h3>
              <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============= WHY JANSETU ============= */}
      <section id="why" className="bg-[#0A1128] text-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Why JanSetu</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              Built for the realities of Indian constituency offices
            </h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: UserCheck, t: "One Person One Identity", d: "Mobile number is a credential, not the identity. Each citizen has one permanent Person id." },
              { icon: History, t: "Lifetime Citizen History", d: "Every complaint, visit and development benefit is recorded forever against the Person." },
              { icon: ShieldCheck, t: "Zero Duplicate Citizens", d: "Cross-constituency duplicate detection at registration time — no double accounts." },
              { icon: Activity, t: "Complete Service Timeline", d: "Person 360 renders every event chronologically with full audit context." },
              { icon: ArrowRightLeft, t: "Constituency Transfer Without Data Loss", d: "Move citizens between offices while preserving all historical records (read-only)." },
              { icon: Home, t: "Household Intelligence", d: "Family-head linked households surface ward, village and address insights automatically." },
              { icon: Network, t: "Family Relationships Preserved", d: "Relationships are person-id linked — they survive transfers, household changes and renames." },
              { icon: Lock, t: "Secure Multi-Tenant Architecture", d: "Tenant isolation at every layer: read filters, write guards, and unique-credential indices." },
              { icon: ShieldAlert, t: "Government-Grade Audit Trail", d: "Person audit + membership audit + timeline events — every state change is append-only." },
            ].map((b) => (
              <div key={b.t} className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
                <div className="w-10 h-10 rounded-md bg-white/10 text-white flex items-center justify-center mb-4">
                  <b.icon size={18} />
                </div>
                <h3 className="font-heading text-base font-semibold">{b.t}</h3>
                <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============= HOW IT WORKS ============= */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Workflow</div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
            How JanSetu Works
          </h2>
          <p className="text-gray-600 mt-3">From the first citizen registration to a lifetime of preserved service history.</p>
        </div>
        <div className="mt-14 relative">
          <div className="hidden lg:block absolute left-0 right-0 top-10 h-px bg-gray-200" />
          <ol className="grid lg:grid-cols-7 gap-4">
            {[
              { icon: UserCheck, t: "Citizen Registration", d: "Mobile-OTP signup with household." },
              { icon: FileText, t: "Issue / Service Request", d: "Photo + GPS attached." },
              { icon: ClipboardList, t: "Office Workflow", d: "Assign → Resolve → Verify." },
              { icon: Calendar, t: "Visits & Dev Works", d: "Targeted announcements." },
              { icon: History, t: "Person 360 History", d: "Lifetime chronological view." },
              { icon: ArrowRightLeft, t: "Constituency Transfer", d: "If the citizen moves." },
              { icon: Lock, t: "History Preserved Forever", d: "Append-only audit ledger." },
            ].map((s, i) => (
              <li key={s.t} className="relative">
                <div className="flex flex-col items-center text-center px-2">
                  <div className="w-20 h-20 rounded-full bg-white border-2 border-[#0A1128] flex items-center justify-center text-[#0A1128] relative z-10">
                    <s.icon size={26} />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400 mt-3">Step {i + 1}</div>
                  <div className="font-heading font-semibold text-sm text-gray-900 mt-1">{s.t}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-snug">{s.d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============= BENEFITS BY USER ============= */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Tailored Experience</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
              Benefits By User
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                tag: "For Citizens", icon: Users, color: "#0A1128",
                items: ["Raise complaints with photos & GPS", "Track issue progress live", "View development works in your area", "Receive targeted announcements", "Visit & camp schedules"],
              },
              {
                tag: "For Workers", icon: Hammer, color: "#0A1128",
                items: ["Assigned task queue", "Area-wise workload view", "Visit tracking & attendance", "Citizen interactions log"],
              },
              {
                tag: "For PA & Office", icon: ClipboardList, color: "#0A1128",
                items: ["Team & staff management", "Issue MIS & reports", "Notifications composer", "Office-wide dashboard", "Audit trail access"],
              },
              {
                tag: "For Elected Representatives", icon: Vote, color: "#0A1128",
                items: ["Complete constituency overview", "Ward-wise analytics", "Citizen lifetime history", "Development monitoring", "Performance insights"],
              },
            ].map((p) => (
              <div key={p.tag} className="border border-gray-200 rounded-lg p-6 bg-[#F9FAFB]">
                <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center mb-4">
                  <p.icon size={18} />
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">{p.tag}</div>
                <ul className="mt-4 space-y-2.5">
                  {p.items.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 size={14} className="text-[#0A1128] mt-1 shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============= PLATFORM PREVIEW ============= */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Platform Preview</div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
            What your team will see every day
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { t: "Dashboard", d: "Office-wide KPIs at a glance.", elements: <DashboardThumb /> },
            { t: "Citizen Profile", d: "Identity, household and contact.", elements: <CitizenProfileThumb /> },
            { t: "Person 360", d: "Lifetime chronological timeline.", elements: <Person360Thumb /> },
            { t: "Issue Management", d: "Assign, resolve, verify, rate.", elements: <IssueThumb /> },
            { t: "Development Works", d: "Public project tracker.", elements: <DevWorkThumb /> },
            { t: "Reports", d: "CSV exports for offline analysis.", elements: <ReportsThumb /> },
            { t: "Notifications", d: "Ward-/village-targeted alerts.", elements: <NotifThumb /> },
          ].map((p) => (
            <div key={p.t} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-[16/10] bg-gradient-to-br from-gray-50 to-white border-b border-gray-200 p-4 flex">
                <div className="flex-1">{p.elements}</div>
              </div>
              <div className="p-4">
                <div className="font-heading font-semibold text-gray-900 text-sm">{p.t}</div>
                <div className="text-xs text-gray-500 mt-1">{p.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============= COUNTERS ============= */}
      <section className="bg-[#0A1128] text-white">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Why Offices Choose JanSetu</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mt-2">
              Numbers that move with every constituency we serve
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-6 gap-3" data-testid="counters">
            <CounterDark value={50000} suffix="+" label="Citizens Managed" />
            <CounterDark value={12000} suffix="+" label="Households" />
            <CounterDark value={9500} suffix="+" label="Issues Resolved" />
            <CounterDark value={1200} suffix="+" label="Development Works" />
            <CounterDark value={350} suffix="+" label="Staff Members" />
            <CounterDark value={48} suffix=" hrs" label="Avg Resolution Time" />
          </div>
        </div>
      </section>

      {/* ============= TESTIMONIALS ============= */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Voices From The Ground</div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
            What constituency offices are saying
          </h2>
          <p className="text-gray-500 mt-3 text-sm">
            Testimonials section ready for client quotes — coming soon as more offices onboard.
          </p>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {[
            { name: "MLA Office", role: "Tier-2 City, Maharashtra", placeholder: true },
            { name: "Corporator", role: "Municipal Ward", placeholder: true },
            { name: "Political Party", role: "State Office", placeholder: true },
          ].map((t) => (
            <div key={t.role} className="border border-gray-200 rounded-lg p-6 bg-white">
              <div className="flex items-center gap-1 text-amber-500">
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <div className="mt-4 h-20 rounded-md bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                Reserved for client testimonial
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="font-heading font-semibold text-sm text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-500">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============= FAQ ============= */}
      <section id="faq" className="bg-white border-y border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">Frequently Asked Questions</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mt-2">
              Answers for offices considering JanSetu
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            <FAQ defaultOpen q="What is JanSetu?" a="JanSetu is a complete Constituency Management Platform that unifies citizens, households, complaints, development works, visits, staff and communication for elected offices and political organisations into one secure, role-based system." />
            <FAQ q="Who can use JanSetu?" a="MLAs, MPs, Corporators, Municipal Corporations, Zilla Parishads, Panchayats, Political Parties and Election War Rooms. Each tenant gets its own branded portal with isolated data." />
            <FAQ q="Can multiple staff members work together?" a="Yes. JanSetu supports role-based access for Workers, PAs, Politicians and Admins, each with the right scope of visibility and write permissions. Reassignment, audit trails and team dashboards are built in." />
            <FAQ q="Can citizens transfer to another constituency?" a="Yes. Citizens can transfer to a new constituency at any time. The old constituency keeps a read-only view of their historical records, while the new constituency starts a fresh active membership — without ever duplicating the Person." />
            <FAQ q="Is citizen history preserved?" a="Absolutely. Every state change is captured in the Person Audit, Membership Audit and Person Timeline collections. History is append-only and survives transfers, profile updates, household changes and credential rotations." />
            <FAQ q="How secure is the platform?" a="JanSetu enforces tenant isolation at the database layer, JWT-signed sessions, unique-mobile credential indices, role-based read/write guards, and a complete audit ledger. Citizen identity is decoupled from any single mobile number." />
          </div>
        </div>
      </section>

      {/* ============= FINAL CTA ============= */}
      <section id="cta" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#0A1128]/95" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-20 text-center text-white">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Sparkles size={14} /> Modernize today
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight mt-6">
            Modernize Your Constituency Office
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Digitally manage citizens, services, development works and your entire constituency from one secure platform.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <a href="mailto:hello@jansetu.in?subject=Book%20a%20Demo" data-testid="cta-book-demo">
              <Button size="lg" className="bg-white text-[#0A1128] hover:bg-gray-100 px-6">
                Book Demo <ArrowRight className="ml-2" size={16} />
              </Button>
            </a>
            <a href="mailto:hello@jansetu.in?subject=Free%20Trial%20Request" data-testid="cta-free-trial">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-6 bg-transparent">
                Request Free Trial
              </Button>
            </a>
            <a href="mailto:sales@jansetu.in?subject=Sales%20Enquiry" data-testid="cta-contact-sales">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 px-6 bg-transparent">
                Contact Sales
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ============= FOOTER ============= */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">JS</div>
              <div className="font-heading font-bold text-[#0A1128] leading-none text-lg">JANSETU</div>
            </div>
            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
              A constituency management service. Mobile-OTP secured. Government-grade audit trail.
            </p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-gray-400">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><a href="#features" className="hover:text-[#0A1128]">Platform features</a></li>
              <li><a href="#why" className="hover:text-[#0A1128]">Why JanSetu</a></li>
              <li><a href="#how" className="hover:text-[#0A1128]">How it works</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-gray-400">For Offices</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link to="/staff/login" className="hover:text-[#0A1128]">Staff & Admin Login</Link></li>
              <li><a href="#cta" className="hover:text-[#0A1128]">Book Demo</a></li>
              <li><a href="mailto:sales@jansetu.in" className="hover:text-[#0A1128]">Contact Sales</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-gray-400">For Citizens</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link to="/citizen/login" className="hover:text-[#0A1128]">Login to Portal</Link></li>
              <li><a href="#faq" className="hover:text-[#0A1128]">FAQ</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-5 text-xs text-gray-500 flex flex-wrap justify-between gap-4">
            <div>© 2026 JANSETU. A constituency management service.</div>
            <div className="flex gap-6">
              <span>Mobile OTP secured</span>
              <span>Government-grade audit trail</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------- Mini preview thumbs (pure CSS, no external assets) ----------
function CounterDark({ value, suffix, label }) {
  const [n, ref] = useCountUp(value);
  return (
    <div ref={ref} className="rounded-lg bg-white/5 border border-white/10 backdrop-blur p-6 text-center">
      <div className="font-heading text-3xl sm:text-4xl font-bold tracking-tight">
        {n.toLocaleString()}{suffix}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mt-2">{label}</div>
    </div>
  );
}

function ThumbShell({ children }) {
  return <div className="w-full h-full flex flex-col gap-2 text-[10px] text-gray-500">{children}</div>;
}

function DashboardThumb() {
  return (
    <ThumbShell>
      <div className="flex gap-1.5">
        <div className="flex-1 h-7 rounded bg-white border border-gray-200" />
        <div className="flex-1 h-7 rounded bg-white border border-gray-200" />
        <div className="flex-1 h-7 rounded bg-white border border-gray-200" />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-1.5">
        <div className="rounded bg-[#0A1128]/10 border border-[#0A1128]/20" />
        <div className="rounded bg-white border border-gray-200" />
        <div className="rounded bg-white border border-gray-200" />
        <div className="rounded bg-emerald-100 border border-emerald-200" />
      </div>
    </ThumbShell>
  );
}

function CitizenProfileThumb() {
  return (
    <ThumbShell>
      <div className="flex gap-2 items-center">
        <div className="w-10 h-10 rounded-full bg-[#0A1128]/15 border border-[#0A1128]/20" />
        <div className="flex-1 space-y-1">
          <div className="h-2 bg-gray-200 rounded w-2/3" />
          <div className="h-1.5 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-1.5 mt-1">
        <div className="h-2 bg-gray-100 rounded" />
        <div className="h-2 bg-gray-100 rounded w-4/5" />
        <div className="h-2 bg-gray-100 rounded w-3/5" />
      </div>
    </ThumbShell>
  );
}

function Person360Thumb() {
  return (
    <ThumbShell>
      <div className="relative pl-4 flex-1">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative mb-2 last:mb-0">
            <div className={`absolute -left-3 top-0.5 w-2 h-2 rounded-full ${i % 2 ? "bg-[#0A1128]" : "bg-emerald-500"}`} />
            <div className="h-1.5 bg-gray-200 rounded w-3/4" />
            <div className="h-1.5 bg-gray-100 rounded w-1/2 mt-1" />
          </div>
        ))}
      </div>
    </ThumbShell>
  );
}

function IssueThumb() {
  return (
    <ThumbShell>
      {[
        { c: "bg-rose-100 border-rose-200", s: "bg-rose-500" },
        { c: "bg-amber-100 border-amber-200", s: "bg-amber-500" },
        { c: "bg-emerald-100 border-emerald-200", s: "bg-emerald-500" },
      ].map((x, i) => (
        <div key={i} className={`flex items-center gap-2 rounded ${x.c} border p-1.5`}>
          <div className={`w-2 h-2 rounded-full ${x.s}`} />
          <div className="h-1.5 bg-white/60 rounded flex-1" />
          <div className="w-8 h-2 bg-white/60 rounded" />
        </div>
      ))}
    </ThumbShell>
  );
}

function DevWorkThumb() {
  return (
    <ThumbShell>
      <div className="flex gap-1.5 items-center">
        <div className="w-6 h-6 rounded bg-[#0A1128]/10 border border-[#0A1128]/20" />
        <div className="flex-1 h-2 bg-gray-200 rounded" />
      </div>
      <div className="flex-1 rounded bg-gradient-to-br from-[#0A1128]/5 to-emerald-100 border border-gray-200 p-2">
        <div className="h-1.5 bg-white/60 rounded w-1/2 mb-1" />
        <div className="h-1.5 bg-white/60 rounded w-3/4" />
      </div>
    </ThumbShell>
  );
}

function ReportsThumb() {
  return (
    <ThumbShell>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="h-5 bg-white border border-gray-200 rounded" />
        <div className="h-5 bg-white border border-gray-200 rounded" />
        <div className="h-5 bg-white border border-gray-200 rounded" />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-1.5 mt-1">
        <div className="rounded bg-gray-50 border border-gray-200 flex items-end gap-1 p-1.5">
          <div className="w-1.5 h-3/4 bg-[#0A1128]/40 rounded-sm" />
          <div className="w-1.5 h-1/2 bg-[#0A1128]/40 rounded-sm" />
          <div className="w-1.5 h-full bg-[#0A1128]/60 rounded-sm" />
          <div className="w-1.5 h-2/3 bg-[#0A1128]/40 rounded-sm" />
        </div>
        <div className="rounded bg-gray-50 border border-gray-200 p-1.5 space-y-1">
          <div className="h-1.5 bg-gray-200 rounded" />
          <div className="h-1.5 bg-gray-200 rounded w-4/5" />
          <div className="h-1.5 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </ThumbShell>
  );
}

function NotifThumb() {
  return (
    <ThumbShell>
      {["bg-blue-100 border-blue-200", "bg-amber-100 border-amber-200", "bg-emerald-100 border-emerald-200"].map((c, i) => (
        <div key={i} className={`rounded ${c} border p-1.5 flex items-start gap-1.5`}>
          <BookOpen size={10} className="text-gray-600 mt-0.5" />
          <div className="flex-1">
            <div className="h-1.5 bg-white/60 rounded w-3/4" />
            <div className="h-1.5 bg-white/40 rounded w-1/2 mt-1" />
          </div>
        </div>
      ))}
    </ThumbShell>
  );
}
