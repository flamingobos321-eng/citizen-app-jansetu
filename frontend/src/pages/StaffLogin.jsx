import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { api, API } from "../lib/api";
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
      .catch(() => setPortalErr("Portal not found or suspended"));
  }, [slug]);

  const theme = portal?.theme_color || "#0A1128";
  const initials = useMemo(() => {
    const name = portal?.politician_name || portal?.constituency_name || "JANSETU";
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "JS";
  }, [portal]);

  const submit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await api.post("/auth/staff/login", { email, password, tenant_slug: slug || undefined });
      loginWithToken(r.data.token, r.data.user);
      toast.success(`Welcome, ${r.data.user.name}`);
      if (r.data.user.must_change_password) {
        navigate("/app/change-password", { replace: true });
      } else {
        navigate("/app");
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid credentials");
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
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Link to={slug ? `/portal/${slug}` : "/"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="back-home">
            <ArrowLeft size={16} /> {slug ? "Back to portal" : "Back to home"}
          </Link>
          <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
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
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-6">Staff sign-in</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              {portal ? `Sign in to ${portal.constituency_name || portal.politician_name} workspace.` : "For workers, PA, politicians and admins."}
            </p>
            {portalErr && (
              <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2" data-testid="login-portal-err">
                {portalErr}
              </div>
            )}

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
              <Button
                type="submit"
                data-testid="staff-login-btn"
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: theme }}
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>

            {!slug && (
              <div className="mt-6 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md p-3 space-y-0.5">
                <div className="font-bold uppercase tracking-widest text-gray-700">Platform demo accounts</div>
                <div>Super Admin · admin@jansetu.in / admin123</div>
                <div className="text-[11px] text-gray-400 mt-1">Tenant admins must sign in via their portal URL (e.g. /staff/login?portal=pune-cantonment).</div>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Are you a citizen?{" "}
            <Link to={slug ? `/citizen/login?portal=${slug}` : "/citizen/login"} className="font-semibold" style={{ color: theme }} data-testid="goto-citizen-login">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
