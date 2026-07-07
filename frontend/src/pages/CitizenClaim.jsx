import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, API, portalAssetUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, Search, User as UserIcon, Home as HomeIcon, IdCard,
  Phone, KeyRound, CheckCircle2, Loader2,
} from "lucide-react";

const BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";
const OFFICE_CODE_RE = /^JS\d{4,}$/i;

// Citizen Registration — Preloaded Electoral Roll flow.
//
// Steps:
//   1. Office Code  (auto-filled from ?office=)
//   2. Search preloaded record (name / relative / house)
//   3. Confirm selected record + enter mobile
//   4. OTP verify → activate account
export default function CitizenClaim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const initialCode = (params.get("office") || "").trim().toUpperCase();
  const [step, setStep] = useState(initialCode ? 2 : 1);
  const [officeCode, setOfficeCode] = useState(initialCode);
  const [portal, setPortal] = useState(null);
  const [portalErr, setPortalErr] = useState(null);

  const [searchForm, setSearchForm] = useState({
    name: "", relative_name: "", house_number: "", epic_number: "",
  });
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpMode, setOtpMode] = useState(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Resolve portal for the office code (branding + suspended check).
  useEffect(() => {
    if (!officeCode || !OFFICE_CODE_RE.test(officeCode)) { setPortal(null); return; }
    fetch(`${API}/portals/office/${officeCode}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((data) => { setPortal(data); setPortalErr(null); })
      .catch(() => { setPortal(null); setPortalErr("Office not found. Please check the code."); });
  }, [officeCode]);

  const theme = portal?.theme_color || "#0A1128";
  const initials = useMemo(() => {
    const name = portal?.politician_name || portal?.constituency_name || "JS";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "JS";
  }, [portal]);

  // ---------- step handlers ----------
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

  const runSearch = async () => {
    if (!searchForm.name && !searchForm.epic_number && !searchForm.house_number) {
      toast.error("Enter at least Name, EPIC or House Number to search");
      return;
    }
    setSearching(true);
    try {
      const r = await api.post("/auth/citizen/search-voter", {
        office_code: officeCode,
        ...searchForm,
      });
      setMatches(r.data.matches || []);
      if ((r.data.matches || []).length === 0) {
        toast.error("No matching voter records found. Contact your office if you believe this is a mistake.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const requestOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (!consent) {
      toast.error("Please accept the Terms and Privacy Policy to continue");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/citizen/claim", {
        office_code: officeCode,
        person_id: selected.id,
        mobile,
      });
      setOtpMode(r.data.mode);
      if (r.data.mode === "development" && r.data.demo_otp) {
        toast.success(`OTP sent (demo: ${r.data.demo_otp})`);
      } else if (r.data.sent) {
        toast.success("OTP sent to your mobile");
      } else {
        toast.error(r.data.reason || "OTP delivery failed");
      }
      setStep(4);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const activate = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/citizen/activate", {
        office_code: officeCode,
        person_id: selected.id,
        mobile, otp,
        device: navigator.userAgent.slice(0, 200),
      });
      loginWithToken(r.data.token, r.data.user);
      localStorage.setItem("jansetu_origin_portal", officeCode);
      toast.success(`Welcome, ${r.data.user.name}! Your account is now active.`);
      navigate("/app");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  const backToSearch = () => {
    setSelected(null);
    setMobile("");
    setOtp("");
    setConsent(false);
    setStep(2);
  };

  // ---------- render ----------
  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0">
        <img src={portal?.hero_image_path ? portalAssetUrl(portal.hero_image_path) : BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
      </div>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <Link
            to={officeCode ? `/o/${officeCode}` : "/"}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
            data-testid="claim-back"
          >
            <ArrowLeft size={16} /> {officeCode ? "Back to portal" : "Back to home"}
          </Link>

          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-md text-white flex items-center justify-center font-heading font-bold overflow-hidden"
                style={{ backgroundColor: theme }}
              >
                {portal?.logo_path
                  ? <img src={portalAssetUrl(portal.logo_path)} alt="" className="w-full h-full object-cover" />
                  : initials}
              </div>
              <div>
                <div className="font-heading font-bold text-lg" style={{ color: theme }}>
                  {portal?.politician_name || portal?.constituency_name || "JANSETU"}
                </div>
                {portal?.office_code && (
                  <div className="text-[11px] text-gray-500 font-mono">Office {portal.office_code}</div>
                )}
              </div>
            </div>

            <h1 className="font-heading text-2xl font-bold text-gray-900 tracking-tight mt-6">
              {step === 1 && "Enter Office Code"}
              {step === 2 && "Find your voter record"}
              {step === 3 && "Confirm & enter mobile"}
              {step === 4 && "Verify OTP"}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {step === 1 && "Enter your Office Code to search the Electoral Roll."}
              {step === 2 && "Search the Electoral Roll to find your record. You do not need to create a new account."}
              {step === 3 && "Verify the details and enter the mobile number you'd like to use to log in."}
              {step === 4 && `OTP sent to +91 ${mobile}`}
            </p>

            <StepIndicator step={step} theme={theme} />

            {portalErr && (
              <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2" data-testid="claim-portal-err">
                {portalErr}
              </div>
            )}

            {/* Step 1 — Office Code */}
            {step === 1 && (
              <div className="mt-6 space-y-4">
                <Field label="Office Code">
                  <Input
                    data-testid="claim-office-code"
                    placeholder="JS1045"
                    value={officeCode}
                    onChange={(e) => setOfficeCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12))}
                    className="text-lg tracking-widest font-mono"
                  />
                </Field>
                <Button
                  data-testid="claim-office-continue"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={submitOfficeCode}
                  disabled={!portal || !!portalErr}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2 — Search */}
            {step === 2 && (
              <div className="mt-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full Name">
                    <Input
                      data-testid="claim-search-name"
                      placeholder="Rahul Suresh Patil"
                      value={searchForm.name}
                      onChange={(e) => setSearchForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </Field>
                  <Field label="Father / Husband / Mother Name">
                    <Input
                      data-testid="claim-search-rel"
                      placeholder="Suresh Patil"
                      value={searchForm.relative_name}
                      onChange={(e) => setSearchForm((f) => ({ ...f, relative_name: e.target.value }))}
                    />
                  </Field>
                  <Field label="House Number (optional)">
                    <Input
                      data-testid="claim-search-house"
                      placeholder="102"
                      value={searchForm.house_number}
                      onChange={(e) => setSearchForm((f) => ({ ...f, house_number: e.target.value }))}
                    />
                  </Field>
                  <Field label="EPIC / Voter ID (optional)">
                    <Input
                      data-testid="claim-search-epic"
                      placeholder="ABC1234567"
                      value={searchForm.epic_number}
                      onChange={(e) => setSearchForm((f) => ({ ...f, epic_number: e.target.value.toUpperCase() }))}
                    />
                  </Field>
                </div>
                <Button
                  data-testid="claim-search-btn"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={runSearch}
                  disabled={searching}
                >
                  {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Search
                </Button>

                {matches.length > 0 && (
                  <div className="space-y-2 mt-4" data-testid="claim-matches">
                    <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Matches</div>
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelected(m); setStep(3); }}
                        className="w-full text-left border border-gray-200 hover:border-[#0A1128] hover:bg-gray-50 rounded-md p-3 transition-colors"
                        data-testid={`claim-match-${m.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{m.name}</span>
                          <span className="text-xs text-gray-500">· Age {m.age ?? "—"} · {m.gender || "—"}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-600 mt-1.5 pl-6">
                          {m.relation_type && (
                            <div>{m.relation_type}: <span className="font-medium">{m.relative_name}</span></div>
                          )}
                          {m.house_number && (
                            <div>House: <span className="font-medium">{m.house_number}</span></div>
                          )}
                          {m.epic_number && (
                            <div>EPIC: <span className="font-mono font-medium">{m.epic_number}</span></div>
                          )}
                          {m.part_number && (
                            <div>Part {m.part_number}{m.serial_number ? ` · Sr. ${m.serial_number}` : ""}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3 — Confirm + Mobile */}
            {step === 3 && selected && (
              <div className="mt-6 space-y-4" data-testid="claim-confirm">
                <div className="rounded-md border-2 border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IdCard className="w-4 h-4 text-gray-600" />
                    <div className="font-heading font-semibold text-gray-900">Your voter record</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="col-span-2 font-semibold">{selected.name}</div>
                    {selected.relation_type && (
                      <Info label={selected.relation_type} value={selected.relative_name} />
                    )}
                    <Info label="Age" value={selected.age} />
                    <Info label="Gender" value={selected.gender} />
                    {selected.house_number && <Info label="House No" value={selected.house_number} icon={HomeIcon} />}
                    {selected.epic_number && <Info label="EPIC" value={selected.epic_number} mono />}
                    {selected.part_number && <Info label="Part / Serial" value={`${selected.part_number}${selected.serial_number ? " · " + selected.serial_number : ""}`} />}
                  </div>
                </div>

                <Field label="Mobile Number">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      data-testid="claim-mobile"
                      placeholder="9999900001"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="pl-10"
                    />
                  </div>
                </Field>

                <label className="flex items-start gap-2 text-xs text-gray-600 select-none">
                  <Checkbox
                    checked={consent}
                    onCheckedChange={setConsent}
                    data-testid="claim-consent"
                    className="mt-0.5"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" className="underline font-semibold">Terms of Service</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" className="underline font-semibold">Privacy Policy</a>{" "}
                    (DPDP Act 2023 compliant). I consent to my personal data being processed by this office.
                  </span>
                </label>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={backToSearch} data-testid="claim-back-search" className="flex-1">
                    Back
                  </Button>
                  <Button
                    data-testid="claim-send-otp"
                    className="flex-1 text-white hover:opacity-90"
                    style={{ backgroundColor: theme }}
                    onClick={requestOtp}
                    disabled={loading || !consent}
                  >
                    {loading ? "Sending..." : "Send OTP"}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4 — OTP */}
            {step === 4 && (
              <div className="mt-6 space-y-4">
                <Field label="6-digit OTP">
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <Input
                      data-testid="claim-otp"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pl-10 tracking-widest"
                    />
                  </div>
                  {otpMode === "development" && (
                    <div className="text-[11px] text-gray-500 mt-1">Development mode: OTP is 123456</div>
                  )}
                </Field>
                <Button
                  data-testid="claim-activate"
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: theme }}
                  onClick={activate}
                  disabled={loading}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating…</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & activate account</>}
                </Button>
                <button onClick={() => setStep(3)} className="block w-full text-xs text-gray-500 hover:text-gray-700" data-testid="claim-change-mobile">
                  Change mobile number
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            Already activated?{" "}
            <Link to={officeCode ? `/citizen/login?office=${officeCode}` : "/citizen/login"} className="font-semibold" style={{ color: theme }} data-testid="claim-goto-login">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value, icon: Icon, mono }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gray-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </div>
      <div className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}

function StepIndicator({ step, theme }) {
  const labels = ["Office", "Search", "Confirm", "OTP"];
  return (
    <div className="flex gap-1 mt-4">
      {labels.map((lb, i) => {
        const active = i + 1 === step;
        const done = i + 1 < step;
        return (
          <div key={lb} className="flex-1">
            <div
              className="h-1 rounded"
              style={{ backgroundColor: done || active ? theme : "#E5E7EB" }}
            />
            <div className={`text-[10px] uppercase tracking-widest mt-1 ${active || done ? "font-bold text-gray-800" : "text-gray-400"}`}>
              {lb}
            </div>
          </div>
        );
      })}
    </div>
  );
}
