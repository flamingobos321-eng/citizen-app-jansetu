import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API, portalAssetUrl } from "../lib/api";
import { ArrowLeft, Loader2, User as UserIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Native Login Choice screen.  Layout per PRD:
//   • Office Logo · Office Name · Representative Name
//   • Primary button: Citizen Login
//   • Small text link below: Staff Login
// NO "Claim Voter Record" button in native — Citizen Login internally routes
// to Search & Claim via the check-mobile gate.
export default function LoginChoice() {
  const [params] = useSearchParams();
  const officeCode = (params.get("office") || localStorage.getItem("jansetu_native_office") || "").toUpperCase();
  const navigate = useNavigate();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!officeCode) {
      navigate("/native", { replace: true });
      return;
    }
    fetch(`${API}/portals/office/${officeCode}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => setPortal(data))
      .catch(() => {
        toast.error("This office is no longer available");
        localStorage.removeItem("jansetu_native_office");
        navigate("/native", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [officeCode, navigate]);

  const changeOffice = () => {
    localStorage.removeItem("jansetu_native_office");
    navigate("/native");
  };

  const theme = portal?.theme_color || "#0A1128";
  const initials = (portal?.politician_name || portal?.constituency_name || "JS")
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div style={{ height: "env(safe-area-inset-top, 0px)" }} />

      {/* Header — small back-to-code control */}
      <header className="px-4 py-3 flex items-center">
        <button onClick={changeOffice} data-testid="native-change-office" className="flex items-center gap-1 text-xs text-gray-600 active:opacity-60">
          <ArrowLeft className="w-4 h-4" /> Change office
        </button>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Office branding */}
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center overflow-hidden shadow-lg"
            style={{ backgroundColor: theme }}
          >
            {portal?.logo_path ? (
              <img src={portalAssetUrl(portal.logo_path)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-heading font-black text-3xl">{initials}</span>
            )}
          </div>

          <div className="mt-6 text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
              Office {officeCode}
            </div>
            <h1 className="mt-1 font-heading text-2xl font-black text-gray-900 tracking-tight">
              {portal?.constituency_name}
            </h1>
            <div className="mt-1 text-sm text-gray-600">
              {portal?.politician_name}{portal?.designation ? ` · ${portal.designation}` : ""}
            </div>
          </div>

          <div className="w-full max-w-xs mt-10 space-y-4">
            <button
              type="button"
              onClick={() => navigate(`/citizen/login?office=${officeCode}`)}
              data-testid="native-citizen-login"
              className="w-full h-14 rounded-2xl text-white font-heading font-bold text-base flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
              style={{ backgroundColor: theme }}
            >
              <UserIcon className="w-5 h-5" /> Citizen Login
            </button>

            <button
              type="button"
              onClick={() => navigate(`/staff/login?office=${officeCode}`)}
              data-testid="native-staff-login"
              className="w-full text-center text-xs text-gray-500 active:text-gray-800 py-2 flex items-center justify-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Staff login
            </button>
          </div>
        </main>
      )}

      <footer className="pb-6 text-center text-[10px] uppercase tracking-widest text-gray-400">
        JanSetu
      </footer>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}
