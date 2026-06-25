import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";

export default function CitizenRegister() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const presetMobile = loc.state?.mobile || "";
  const tenantSlug = loc.state?.tenant_slug || null;
  const portal = loc.state?.portal || null;

  const [areas, setAreas] = useState([]);
  const [form, setForm] = useState({
    name: "",
    mobile: presetMobile,
    gender: "Male",
    dob: "",
    region_type: "urban",
    ward_id: "",
    village_id: "",
    house_number: "",
    address: "",
    family_head_name: "",
    members_count: 1,
  });
  const [loading, setLoading] = useState(false);

  // ---------- Transfer flow state ----------
  const [transferContext, setTransferContext] = useState(null); // detection payload
  const [transferStage, setTransferStage] = useState("idle");   // idle | confirm | otp | submitting
  const [transferReq, setTransferReq] = useState(null);          // {transfer_request_id, expires_at, demo_otp}
  const [transferOtp, setTransferOtp] = useState("");
  const [transferReason, setTransferReason] = useState("");

  useEffect(() => {
    api.get("/areas").then((r) => setAreas(r.data));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.mobile || !form.house_number || !form.address) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, tenant_slug: tenantSlug || undefined };
      const r = await api.post("/auth/citizen/register", payload);
      loginWithToken(r.data.token, r.data.user);
      if (tenantSlug) localStorage.setItem("jansetu_origin_portal", tenantSlug);
      else localStorage.removeItem("jansetu_origin_portal");
      toast.success(`Welcome! Household ${r.data.household.household_code} created.`);
      navigate("/app");
    } catch (e) {
      // V2 transfer detection: HTTP 409 with detail.code === "TRANSFER_REQUIRED"
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409 && detail && detail.code === "TRANSFER_REQUIRED") {
        setTransferContext(detail);
        setTransferStage("confirm");
      } else {
        toast.error(typeof detail === "string" ? detail : (detail?.message || "Registration failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // ---------- Transfer actions ----------
  const handleInitiateTransfer = async () => {
    if (!tenantSlug) {
      toast.error("Portal context missing — please access this page via your constituency portal link.");
      return;
    }
    setTransferStage("submitting");
    try {
      const r = await api.post("/auth/citizen/transfer/initiate", {
        mobile: form.mobile, target_tenant_slug: tenantSlug,
        reason: transferReason || null,
      });
      setTransferReq(r.data);
      setTransferStage("otp");
      toast.success("OTP sent. (Demo OTP: 123456)");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not initiate transfer");
      setTransferStage("confirm");
    }
  };

  const handleVerifyTransfer = async () => {
    if (!transferOtp || transferOtp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    setTransferStage("submitting");
    try {
      const r = await api.post("/auth/citizen/transfer/verify", {
        transfer_request_id: transferReq.transfer_request_id,
        otp: transferOtp,
        new_address: {
          region_type: form.region_type,
          house_number: form.house_number,
          ward_id: form.ward_id || null,
          village_id: form.village_id || null,
          address: form.address,
          members_count: form.members_count,
          family_head_name: form.family_head_name || form.name,
        },
      });
      loginWithToken(r.data.token, r.data.user);
      if (tenantSlug) localStorage.setItem("jansetu_origin_portal", tenantSlug);
      toast.success(
        `Transfer complete. Welcome to ${
          r.data.user.tenant_id ? (transferContext?.target_tenant?.constituency_name || "your new constituency") : ""
        }!`
      );
      setTransferStage("idle");
      setTransferContext(null);
      navigate("/app");
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Transfer verification failed");
      setTransferStage("otp");
    }
  };

  const cancelTransfer = () => {
    setTransferStage("idle");
    setTransferContext(null);
    setTransferReq(null);
    setTransferOtp("");
    setTransferReason("");
  };

  const wards = areas.filter((a) => a.kind === "ward");
  const villages = areas.filter((a) => a.kind === "village");

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to={tenantSlug ? `/citizen/login?portal=${tenantSlug}` : "/citizen/login"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-login">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          {portal && (
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500" data-testid="reg-portal-context">
              Registering in <span className="font-semibold" style={{ color: portal.theme_color || "#0A1128" }}>{portal.constituency_name || portal.politician_name}</span>
            </div>
          )}
          <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight">Complete your registration</h1>
          <p className="text-sm text-gray-500 mt-1.5">We&apos;ll create a household record for your address.</p>

          <div className="mt-8 grid sm:grid-cols-2 gap-5">
            <Field label="Full Name *">
              <Input data-testid="reg-name" value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </Field>
            <Field label="Mobile *">
              <Input data-testid="reg-mobile" value={form.mobile} onChange={(e) => upd("mobile", e.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => upd("gender", v)}>
                <SelectTrigger data-testid="reg-gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of Birth (optional)">
              <Input type="date" data-testid="reg-dob" value={form.dob} onChange={(e) => upd("dob", e.target.value)} />
            </Field>

            <div className="sm:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Region</Label>
              <RadioGroup value={form.region_type} onValueChange={(v) => upd("region_type", v)} className="flex gap-6 mt-2">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="urban" data-testid="reg-urban" /> Urban
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="rural" data-testid="reg-rural" /> Rural
                </label>
              </RadioGroup>
            </div>

            {form.region_type === "urban" ? (
              <Field label="Ward">
                <Select value={form.ward_id} onValueChange={(v) => upd("ward_id", v)}>
                  <SelectTrigger data-testid="reg-ward"><SelectValue placeholder="Select ward" /></SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Village">
                <Select value={form.village_id} onValueChange={(v) => upd("village_id", v)}>
                  <SelectTrigger data-testid="reg-village"><SelectValue placeholder="Select village" /></SelectTrigger>
                  <SelectContent>
                    {villages.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="House Number *">
              <Input data-testid="reg-house" value={form.house_number} onChange={(e) => upd("house_number", e.target.value)} />
            </Field>
            <Field label="Family Head Name">
              <Input data-testid="reg-head" value={form.family_head_name} onChange={(e) => upd("family_head_name", e.target.value)} placeholder="Same as your name if you are the head" />
            </Field>
            <Field label="Members Count">
              <Input type="number" min="1" data-testid="reg-members" value={form.members_count} onChange={(e) => upd("members_count", parseInt(e.target.value || "1", 10))} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Full Address *">
                <Textarea data-testid="reg-address" rows={2} value={form.address} onChange={(e) => upd("address", e.target.value)} />
              </Field>
            </div>
          </div>

          <Button
            data-testid="reg-submit"
            className="w-full mt-8 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create my household"}
          </Button>
        </div>
      </div>

      {/* ---------- Transfer Confirm Dialog ---------- */}
      <Dialog open={transferStage === "confirm"} onOpenChange={(o) => { if (!o) cancelTransfer(); }}>
        <DialogContent className="sm:max-w-md" data-testid="transfer-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-amber-600" />
              Mobile number already exists
            </DialogTitle>
            <DialogDescription>
              We found your account in a different constituency. Would you like to transfer your registration here?
            </DialogDescription>
          </DialogHeader>
          {transferContext && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-gray-200 p-3 bg-gray-50">
                <div className="text-[10px] uppercase font-bold tracking-[0.1em] text-gray-500">Current Constituency</div>
                <div className="font-semibold text-gray-900 mt-0.5" data-testid="transfer-from-name">
                  {transferContext.current_tenant?.constituency_name || transferContext.current_tenant?.slug}
                </div>
              </div>
              <div className="rounded-md border-2 border-amber-200 p-3 bg-amber-50">
                <div className="text-[10px] uppercase font-bold tracking-[0.1em] text-amber-700">You are registering under</div>
                <div className="font-semibold text-gray-900 mt-0.5" data-testid="transfer-to-name">
                  {transferContext.target_tenant?.constituency_name || transferContext.target_tenant?.slug}
                </div>
              </div>
              <Field label="Reason for transfer (optional)">
                <Input
                  data-testid="transfer-reason"
                  placeholder="e.g. job, marriage, education"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </Field>
              <p className="text-xs text-gray-500 leading-relaxed">
                Your historical records in {transferContext.current_tenant?.constituency_name} will be preserved (read-only). Your active service history will continue here in {transferContext.target_tenant?.constituency_name}.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelTransfer} data-testid="transfer-cancel">Cancel</Button>
            <Button
              data-testid="transfer-confirm"
              className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              onClick={handleInitiateTransfer}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Transfer OTP Dialog ---------- */}
      <Dialog open={transferStage === "otp" || transferStage === "submitting"} onOpenChange={(o) => { if (!o) cancelTransfer(); }}>
        <DialogContent className="sm:max-w-md" data-testid="transfer-otp-dialog">
          <DialogHeader>
            <DialogTitle>Verify OTP</DialogTitle>
            <DialogDescription>
              Enter the 6-digit OTP sent to <span className="font-semibold">{form.mobile}</span> to complete the transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="OTP *">
              <Input
                data-testid="transfer-otp-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={transferOtp}
                onChange={(e) => setTransferOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {transferReq?.demo_otp && (
                <div className="text-[11px] text-gray-400 mt-1">Demo OTP: {transferReq.demo_otp}</div>
              )}
            </Field>
            <p className="text-xs text-gray-500">
              We will create a new household for you at <span className="font-semibold">{form.house_number}</span>, {form.address}.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelTransfer} data-testid="transfer-otp-cancel">Cancel</Button>
            <Button
              data-testid="transfer-otp-submit"
              className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              onClick={handleVerifyTransfer}
              disabled={transferStage === "submitting"}
            >
              {transferStage === "submitting" ? "Transferring…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
