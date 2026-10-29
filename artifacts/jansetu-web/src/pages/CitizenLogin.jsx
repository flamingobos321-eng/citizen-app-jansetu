import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, API, portalAssetUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Phone, KeyRound, ArrowLeft, ShieldOff } from "lucide-react";
import { isNativePlatform } from "../native/platform";

const BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

const OFFICE_CODE_RE = /^JS\d{4,}$/i;

export default function CitizenLogin() {
  const [params] = useSearchParams();
  // Accept EITHER office code (JS####) or legacy slug via ?portal= or ?office=.
  const initial = (params.get("office") || params.get("portal") || "").trim();
  const initialUpper = initial.toUpperCase();
  const hasPrefill = !!initial;

  // Step flow:
  //   1 = Enter Office Code (skipped if URL already provides one)
  //   2 = Enter Mobile
  //   3 = Enter OTP
  const [step, setStep] = useState(hasPrefill ? 2 : 1);
  const [officeCode, setOfficeCode] = useState(hasPrefill ? initialUpper : "");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState(null);
  const [portalErr, setPortalErr] = useState(null);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  // The `slug` we pass to the backend can be an Office Code OR a legacy slug —
  // `_resolve_tenant_id` accepts both. We keep the raw value here.
  const tenantIdent = officeCode || (hasPrefill ? initial : "");

  useEffect(() => {
    if (!tenantIdent) { setPortal(null); return; }
    const path = OFFICE_CODE_RE.test(tenantIdent)
      ? `/portals/office/${tenantIdent.toUpperCase()}`
      : `/portals/${tenantIdent.toLowerCase()}`;
    fetch(`${API}${path}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => { setPortal(data); setPortalErr(null); })
      .catch(() => { setPortal(null); setPortalErr("Office not found. Please check the code."); });
  }, [tenantIdent]);

  const suspended = portal?.portal_status === "suspended";
  const theme = portal?.theme_color || "#0A1128";
  const initials = useMemo(() => {
    const name = portal?.politician_name || portal?.constituency_name || "JANSETU";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "JS";
  }, [portal]);

  const submitOfficeCode = () => {
    const code = officeCode.trim().toUpperCase();
    if (!OFFICE_CODE_RE.test(code)) {
      toast.error("Enter a valid Office Code (e.g. JS1045)");
      return;
    }
    if (portalErr || !portal) {
      toast.error("Please verify the Office Code");
      return;
    }
    setOfficeCode(code);
    setStep(2);
  };

  const sendOtp = async () => {
    if (suspended) { toast.error("This office is suspended"); return; }
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      // Gate check — is this mobile already linked to an activated citizen
      // in this office?  If not, route to the Search & Claim flow instead of
      // sending an OTP for a non-existent account.
      const check = await api.post("/auth/citizen/check-mobile", {
        mobile, tenant_slug: tenantIdent || undefined,
      });
      // detect_transfer_need returns:
      //   { exists: false }                       → not linked anywhere
      //   { exists: true, same_tenant: true }     → linked here (proceed)
      //   { exists: true, same_tenant: false }    → linked elsewhere (transfer)
      if (check.data.exists && check.data.same_tenant === false) {
        // A stale/missing source portal cannot be transferred automatically.
        // Respect the backend's safety decision instead of sending the citizen
        // to a transfer flow that cannot be completed.
        if (check.data.can_transfer === false) {
          toast.error(
            check.data.message ||
              "We could not verify this account's constituency. Please contact support.",
          );
          return;
        }
        toast.info("This mobile is registered in another constituency. Redirecting to transfer…");
        setTimeout(() => navigate(`/citizen/register?mobile=${mobile}&office=${(tenantIdent || "").toUpperCase()}&transfer=1`), 1200);
        return;
      }
      if (!check.data.exists) {
        // No account for this mobile → Search & Claim flow.
        toast.info("New mobile — let's find your voter record.");
        navigate(
          `/citizen/claim${tenantIdent ? `?office=${tenantIdent.toUpperCase()}` : ""}`,
          { state: { mobile, tenant_slug: tenantIdent || null, portal } },
        );
        return;
      }

      // Linked in this tenant → send OTP.
      const r = await api.post("/auth/citizen/request-otp", { mobile, tenant_slug: tenantIdent || undefined });
      if (r.data.mode === "development") {
        toast.success(`OTP sent (demo: ${r.data.demo_otp})`);
      } else if (r.data.sent) {
        toast.success("OTP sent to your mobile");
      } else {
        toast.error(r.data.reason || "OTP delivery failed. Try again.");
      }
      setStep(3);
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
      const r = await api.post("/auth/citizen/verify-otp", { mobile, otp, tenant_slug: tenantIdent || undefined });
      if (r.data.transferred_out) {
        // Citizen was transferred out of THIS constituency — point them to the
        // portal they actually belong to now.
        const cur = r.data.current_portal;
        if (cur?.office_code || cur?.slug) {
          const target = cur.office_code || cur.slug;
          toast.error(`You have been transferred to ${cur.constituency_name || target}. Please log in there.`);
          setTimeout(() => navigate(`/citizen/login?office=${target}`), 1500);
        } else {
          toast.error(r.data.message || "You have been transferred to another constituency.");
        }
        return;
      }
      if (r.data.new_user) {
        // No user account for this mobile → route to the new "Search & Claim"
        // preloaded-voter onboarding flow (not the legacy open-register page).
        toast.info("Let's find your voter record to activate your account.");
        navigate(`/citizen/claim${tenantIdent ? `?office=${tenantIdent.toUpperCase()}` : ""}`, {
          state: { mobile, tenant_slug: tenantIdent || null, portal },
        });
      } else {
        loginWithToken(r.data.token, r.data.user);
        if (tenantIdent) localStorage.setItem("jansetu_origin_portal", tenantIdent);
        else localStorage.removeItem("jansetu_origin_portal");
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
        <img src={portal?.hero_image_path ? portalAssetUrl(portal.hero_image_path) : BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
      </div>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to={tenantIdent ? `/o/${tenantIdent.toUpperCase()}` : "/"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-home">
            <ArrowLeft size={16} /> {tenantIdent ? "Back to portal" : "Back to home"}
          </Link>

          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-md text-white flex items-center justify-center font-heading font-bold overflow-hidden"
                style={{ backgroundColor: theme }}
                data-testid="login-brand-mark"
              >
                {portal?.logo_path ? (
                  <img src={portalAssetUrl(portal.logo_path)} alt="" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="font-heading font-bold text-lg" style={{ color: theme }} data-testid="login-brand-name">
                {portal ? (portal.politician_name || portal.constituency_name) : "JANSETU"}
              </div>
            </div>
            {portal?.office_code && (
              <div className="text-[11px] text-gray-500 mt-1 font-mono" data-testid="login-office-code">Office {portal.office_code}</div>
            )}
            {portal?.constituency_name && (
              <div className="text-xs text-gray-500 mt-0.5" data-testid="login-brand-constituency">{portal.constituency_name}</div>
            )}
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-6">
              {step === 1 ? "Enter Office Code" : step === 2 ? "Citizen sign-in" : "Verify your number"}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {step === 1
                ? "Enter your Office Code to continue. Scan the QR at your MLA office if you don't know it."
                : step === 2
                ? (portal ? `Sign in to ${portal.constituency_name || "this office"}.` : "Sign in with your mobile number")
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
                      This office portal has been temporarily suspended.
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
                  <Label htmlFor="office" className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Office Code</Label>
                  <Input
                    id="office"
                    data-testid="office-code-input"
                    placeholder="JS1045"
                    value={officeCode}
                    onChange={(e) => setOfficeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                    className="text-lg tracking-widest font-mono"
                  />
                </div>
                {portal && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 flex items-center gap-3" data-testid="office-preview-card">
                    <div className="w-10 h-10 rounded-md text-white flex items-center justify-center font-bold text-sm overflow-hidden shrink-0" style={{ backgroundColor: theme }}>
                      {portal.logo_path ? <img src={portalAssetUrl(portal.logo_path)} alt="" className="w-full h-full object-cover" /> : initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-gray-900 truncate">{portal.politician_name}</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {portal.office_type || portal.designation} · {portal.constituency_name}
                        {portal.district && ` · ${portal.district}`}
                        {portal.state && `, ${portal.state}`}
                      </div>
                      <div className="text-[11px] text-gray-600 font-semibold mt-0.5">You are joining this Office.</div>
                    </div>
                  </div>
                )}
                <Button
                  data-testid="office-continue-btn"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={submitOfficeCode}
                  disabled={!portal || !!portalErr}
                >
                  Continue
                </Button>
              </div>
            )}
            {!suspended && step === 2 && (
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
                <button onClick={() => setStep(1)} className="block w-full text-xs text-gray-500 hover:text-gray-700" data-testid="change-office">
                  Change Office Code
                </button>
                {!tenantIdent && (
                  <p className="text-xs text-gray-500 text-center">
                    Demo number: <span className="font-semibold">9999900001</span> · OTP: <span className="font-semibold">123456</span>
                  </p>
                )}
              </div>
            )}
            {!suspended && step === 3 && (
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
                <button onClick={() => setStep(2)} className="block w-full text-xs text-gray-500 hover:text-gray-700" data-testid="change-mobile">
                  Change mobile number
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Are you staff or admin?{" "}
            <Link to={tenantIdent ? `/staff/login?office=${tenantIdent.toUpperCase()}` : "/staff/login"} className="font-semibold" style={{ color: theme }} data-testid="goto-staff-login">
              Sign in here
            </Link>
          </p>
          {!isNativePlatform() && (
            <p className="text-center text-xs text-gray-500 mt-2">
              First time here?{" "}
              <Link
                to={tenantIdent ? `/citizen/claim?office=${tenantIdent.toUpperCase()}` : "/citizen/claim"}
                className="font-semibold" style={{ color: theme }} data-testid="goto-claim"
              >
                Claim your voter record
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
