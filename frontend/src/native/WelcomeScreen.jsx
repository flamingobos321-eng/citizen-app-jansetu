import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../lib/api";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";

const OFFICE_CODE_RE = /^JS\d{4,}$/i;

// Native Welcome Screen — shown only inside the Capacitor Android/iOS app.
// Single entry-point: Office Code → validate → LoginChoice (Citizen primary,
// Staff as a small link). NO "Claim Voter Record" button anywhere in native.
export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // If a previously-validated office code exists, skip straight to Login Choice.
  useEffect(() => {
    const cached = localStorage.getItem("jansetu_native_office");
    if (cached && OFFICE_CODE_RE.test(cached)) {
      navigate(`/native/login?office=${cached}`, { replace: true });
    }
  }, [navigate]);

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (!OFFICE_CODE_RE.test(c)) {
      toast.error("Enter a valid Office Code (e.g. JS1045)");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/portals/office/${c}`);
      if (!r.ok) {
        toast.error("Office not found. Please check the code.");
        return;
      }
      localStorage.setItem("jansetu_native_office", c);
      navigate(`/native/login?office=${c}`);
    } catch (e) {
      toast.error("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1128] flex flex-col text-white overflow-hidden">
      {/* status-bar spacer (Android/iOS safe area) */}
      <div style={{ height: "env(safe-area-inset-top, 0px)" }} />

      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-8 shadow-xl">
          <div className="font-heading font-black text-4xl tracking-tight">JS</div>
        </div>

        <h1 className="font-heading text-3xl font-black tracking-tight text-center">
          Welcome to JanSetu
        </h1>
        <p className="text-sm text-white/70 mt-2 text-center max-w-xs">
          Enter your Office Code to connect with your representative
        </p>

        <div className="mt-10 w-full max-w-xs">
          <label className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-bold block mb-2">
            Office Code
          </label>
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            data-testid="native-office-code"
            placeholder="JS1045"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full h-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 text-xl tracking-widest font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-white/60 transition-colors"
          />

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            data-testid="native-office-continue"
            className="mt-4 w-full h-14 bg-white text-[#0A1128] rounded-2xl font-heading font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ChevronRight className="w-5 h-5" /></>}
          </button>

          <p className="mt-6 text-center text-[11px] text-white/50">
            Don&apos;t know your Office Code?{" "}
            <a href="https://jansetu.in/find-office" target="_blank" rel="noopener noreferrer" className="text-white/80 underline">
              Find your office
            </a>
          </p>
        </div>
      </main>

      <footer className="pb-8 text-center text-[10px] uppercase tracking-widest text-white/40">
        JanSetu · Serving India&apos;s Constituencies
      </footer>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}
