import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, ArrowLeft } from "lucide-react";

const BG = "https://images.pexels.com/photos/19883685/pexels-photo-19883685.jpeg";

export default function StaffLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/staff/login", { email, password });
      loginWithToken(r.data.token, r.data.user);
      toast.success(`Welcome, ${r.data.user.name}`);
      navigate("/app");
    } catch (err) {
      toast.error("Invalid credentials");
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
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-home">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-md bg-[#0A1128] text-white flex items-center justify-center font-heading font-bold">JS</div>
              <div className="font-heading font-bold text-[#0A1128] text-lg">JANSETU</div>
            </div>
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-6">Staff sign-in</h1>
            <p className="text-sm text-gray-500 mt-1.5">For workers, PA, politicians and admins.</p>

            <div className="mt-7 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <Input data-testid="staff-email" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <Input type="password" data-testid="staff-password" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <Button type="submit" data-testid="staff-login-btn" className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>

            <div className="mt-6 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 space-y-0.5">
              <div className="font-bold uppercase tracking-widest text-gray-700">Demo accounts</div>
              <div>Admin · admin@jansetu.in / admin123</div>
              <div>MLA · mla@jansetu.in / mla123</div>
              <div>PA · pa@jansetu.in / pa123</div>
              <div>Worker · worker1@jansetu.in / worker123</div>
            </div>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Are you a citizen?{" "}
            <Link to="/citizen/login" className="font-semibold text-[#0A1128]" data-testid="goto-citizen-login">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
