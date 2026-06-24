import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Phone, KeyRound, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

export default function CitizenLogin() {
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/auth/citizen/request-otp", { mobile });
      toast.success(`OTP sent (demo: ${r.data.demo_otp})`);
      setStep(2);
    } catch (e) {
      toast.error("Failed to send OTP");
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
      const r = await api.post("/auth/citizen/verify-otp", { mobile, otp });
      if (r.data.new_user) {
        navigate("/citizen/register", { state: { mobile } });
      } else {
        loginWithToken(r.data.token, r.data.user);
        toast.success(`Welcome, ${r.data.user.name}`);
        navigate("/app");
      }
    } catch (e) {
      toast.error("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0">
        <img src={BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/92 backdrop-blur-sm" />
      </div>
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-home">
            <ArrowLeft size={16} /> Back to home
          </Link>

          <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">JS</div>
              <div className="font-heading font-bold text-[#0A1128] text-lg">JANSETU</div>
            </div>
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-6">
              {step === 1 ? "Citizen sign-in" : "Verify your number"}
            </h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {step === 1 ? "Sign in with your mobile number" : `OTP sent to +91 ${mobile}`}
            </p>

            {step === 1 ? (
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
                  className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
                  onClick={sendOtp}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Demo number: <span className="font-semibold">9999900001</span> · OTP: <span className="font-semibold">123456</span>
                </p>
              </div>
            ) : (
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
                  className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
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
            <Link to="/staff/login" className="font-semibold text-[#0A1128]" data-testid="goto-staff-login">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
