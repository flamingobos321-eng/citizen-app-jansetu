import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, API } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Phone, KeyRound, ArrowLeft, ShieldOff } from "lucide-react";

const BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

export default function CitizenLogin() {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const slug = (params.get("portal") || "").trim().toLowerCase();
  const [portal, setPortal] = useState(null);
  const [portalErr, setPortalErr] = useState(null);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) { setPortal(null); return; }
    fetch(`${API}/portals/${slug}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => { setPortal(data); setPortalErr(null); })
      .catch(() => setPortalErr("Portal not found"));
  }, [slug]);

  const suspended = portal?.portal_status === "suspended";
  const theme = portal?.theme_color || "#0A1128";
  const initials = useMemo(() => {
    const name = portal?.politician_name || portal?.constituency_name || "JANSETU";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "JS";
  }, [portal]);

  const sendOtp = async () => {
    if (suspended) { toast.error("This portal is suspended"); return; }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/citizen/request-otp", { mobile, tenant_slug: slug || undefined });
      toast.success(`OTP sent (demo: ${r.data.demo_otp})`);
      setStep(2);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/citizen/verify-otp", { mobile, otp, tenant_slug: slug || undefined });
      if (r.data.new_user) {
        navigate("/citizen/register", { state: { mobile, tenant_slug: slug || null, portal } });
      } else {
        loginWithToken(r.data.token, r.data.user);
        toast.success(`Welcome, ${r.data.user.name}`);
        navigate("/app");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0">
        <img src={portal?.hero_image_path ? `${API}/files/${portal.hero_image_path}` : BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
      </div>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to={slug ? `/portal/${slug}` : "/"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-home">
            <ArrowLeft size={16} /> {slug ? "Back to portal" : "Back to home"}
          </Link>

          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-md text-white flex items-center justify-center font-heading font-bold overflow-hidden"
                style={{ backgroundColor: theme }}
                data-testid="login-brand-mark"
              >
                {portal?.logo_path ? (
                  <img src={`${API}/files/${portal.logo_path}`} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="font-heading font-bold text-lg" style={{ color: theme }} data-testid="login-brand-name">
                {portal ? (portal.politician_name || portal.constituency_name) : "JANSETU"}
              </div>
            </div>
            {portal?.constituency_name && (
              <div className="text-xs text-gray-500 mt-1" data-testid="login-brand-constituency">{portal.constituency_name}</div>
            )}
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-6">
              {step === 1 ? "Citizen sign-in" : "Verify your number"}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {step === 1
                ? (portal ? `Sign in with your mobile number to access ${portal.constituency_name || "this constituency"}.` : "Sign in with your mobile number")
                : `OTP sent to +91 ${mobile}`}
            </p>
            {portalErr && (
              <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2" data-testid="login-portal-err">
                {portalErr}
              </div>
            )}

            {suspended && (
              <div
                className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4"
                data-testid="login-suspended-notice"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <ShieldOff className="text-amber-700 shrink-0 mt-0.5" size={18} />
                  <div className="text-sm">
                    <div className="font-heading font-bold text-amber-900">Account Suspended</div>
                    <p className="text-amber-900/90 mt-1">
                      This constituency portal has been temporarily suspended.
                    </p>
                    <p className="text-amber-900/80 mt-1">
                      Please contact your service provider for assistance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!suspended && step === 1 && (
              <div className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mobile" className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Mobile number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      id="mobile"
                      data-testid="mobile-input"
                      placeholder="9999900001"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  data-testid="send-otp-btn"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={sendOtp}
                  disabled={loading || !!portalErr}
                >
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
                {!slug && (
                  <p className="text-xs text-gray-500 text-center">
                    Demo number: <span className="font-semibold">9999900001</span> · OTP: <span className="font-semibold">123456</span>
                  </p>
                )}
              </div>
            )}
            {!suspended && step === 2 && (
              <div className="mt-7 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">6-digit OTP</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      id="otp"
                      data-testid="otp-input"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pl-10 tracking-widest"
                    />
                  </div>
                </div>
                <Button
                  data-testid="verify-otp-btn"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={verify}
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify & continue"}
                </Button>
                <button onClick={() => setStep(1)} className="block w-full text-xs text-gray-500 hover:text-gray-700" data-testid="change-mobile">
                  Change mobile number
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Are you staff or admin?{" "}
            <Link to={slug ? `/staff/login?portal=${slug}` : "/staff/login"} className="font-semibold" style={{ color: theme }} data-testid="goto-staff-login">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
