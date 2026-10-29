import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, Lock, KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const forced = !!user?.must_change_password;

  const submit = async (e) => {
    e?.preventDefault();
    if (next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: current,
        new_password: next,
      });
      // Refresh /auth/me so must_change_password flips false
      try {
        const r = await api.get("/auth/me");
        setUser(r.data);
      } catch (_) { /* ignore */ }
      toast.success("Password changed. Welcome aboard!");
      navigate("/app", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-gray-900 tracking-tight">
                {forced ? "Set your password" : "Change password"}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {forced
                  ? "For security, please replace the temporary password before continuing."
                  : "Choose a new password for your account."}
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">
                {forced ? "Temporary password" : "Current password"}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="password"
                  data-testid="cp-current"
                  className="pl-10"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="password"
                  data-testid="cp-new"
                  className="pl-10"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  type="password"
                  data-testid="cp-confirm"
                  className="pl-10"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              data-testid="cp-submit"
              className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              disabled={saving}
            >
              {saving ? "Saving…" : "Update password"}
            </Button>
            {forced && (
              <button
                type="button"
                onClick={() => {
                  const origin = localStorage.getItem("jansetu_origin_portal");
                  const isSuper = user?.role === "super_admin";
                  localStorage.removeItem("jansetu_origin_portal");
                  const target = (origin && !isSuper) ? `/portal/${origin}` : "/";
                  logout();
                  window.location.assign(target);
                }}
                className="block w-full text-xs text-gray-500 hover:text-gray-700"
                data-testid="cp-logout"
              >
                Sign out instead
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
