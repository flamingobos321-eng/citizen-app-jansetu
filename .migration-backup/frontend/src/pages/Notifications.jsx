import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Bell, BellRing, BellOff, CheckCheck, Zap, Send, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { enablePushNotifications } from "../lib/pushBootstrap";
import { pushConfigured } from "../lib/push";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;   // "default" | "granted" | "denied"
  });

  const loadInbox = () => {
    api.get("/push/inbox").then((r) => {
      setInbox(r.data.notifications || []);
      setUnreadCount(r.data.unread_count || 0);
    }).catch(() => { /* ignore */ });
  };

  useEffect(() => {
    api.get("/notifications").then((r) => setItems(r.data));
    loadInbox();
  }, []);

  const enable = async () => {
    const r = await enablePushNotifications();
    if (r.registered) {
      toast.success("Push notifications enabled");
      setPushState("granted");
    } else {
      const reason = ({
        "permission-denied": "You blocked notifications for this site. Enable them in your browser settings.",
        "permission-refused": "Notifications permission was not granted.",
        "firebase-not-configured": "Push notifications aren't configured on this deployment.",
        "notifications-unsupported": "Your browser doesn't support push notifications.",
        "messaging-unsupported": "Your browser doesn't support Firebase Cloud Messaging.",
      })[r.reason] || `Couldn't enable push (${r.reason})`;
      toast.error(reason);
    }
  };

  const markAllRead = async () => {
    await api.post("/push/inbox/read-all");
    toast.success("All caught up");
    loadInbox();
  };

  const canCompose = ["pa", "politician", "admin"].includes(user?.role);
  const canAdmin = ["admin", "super_admin"].includes(user?.role);
  const pushBannerVisible = pushConfigured() && pushState !== "granted" && pushState !== "unsupported";

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Targeted alerts from your representative's office">Notifications</SectionTitle>

      {pushBannerVisible && (
        <div className="bg-[#0A1128]/5 border border-[#0A1128]/20 rounded-lg p-4 flex items-start gap-3" data-testid="push-enable-banner">
          <BellRing className="w-5 h-5 text-[#0A1128] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-heading font-semibold text-gray-900">Get real-time alerts</div>
            <p className="text-xs text-gray-600 mt-0.5">
              Receive updates on your issues, celebrations, and important announcements even when JanSetu is closed.
            </p>
          </div>
          <Button size="sm" onClick={enable} data-testid="push-enable-btn" className="bg-[#0A1128] text-white hover:opacity-90">
            Enable notifications
          </Button>
        </div>
      )}

      {inbox.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-4" data-testid="push-inbox">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#0A1128]" />
              <span className="font-heading font-semibold text-gray-900">Your inbox</span>
              {unreadCount > 0 && (
                <span className="text-[10px] uppercase tracking-widest font-bold bg-[#0A1128] text-white px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} data-testid="push-inbox-read-all">
                <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {inbox.slice(0, 10).map((n) => (
              <div
                key={n.id}
                data-testid={`inbox-item-${n.id}`}
                className={`py-3 flex items-start gap-3 ${!n.read ? "bg-blue-50/30 -mx-4 px-4" : ""}`}
              >
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#0A1128] flex-shrink-0 mt-2" />}
                {n.read && <span className="w-2 h-2 flex-shrink-0 mt-2" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{n.title}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {canAdmin && (
        <PushDiagnostics />
      )}

      {canCompose && (
        <Composer onCreated={(n) => setItems((x) => [n, ...x])} />
      )}

      {items.length === 0 ? (
        <EmptyState title="No notifications" hint="When your office sends announcements, they will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} data-testid={`notif-card-${n.id}`} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pill pill-info">{n.notif_type}</span>
                <span className="text-xs text-gray-500">{new Date(n.created_at).toLocaleString()}</span>
                {canCompose && n.created_by_name && (
                  <span className="text-xs text-gray-500">· by {n.created_by_name}</span>
                )}
              </div>
              <div className="font-heading font-semibold text-gray-900 mt-2">{n.title}</div>
              <div className="text-sm text-gray-700 mt-1">{n.body}</div>
              {canCompose && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>Target: <strong className="text-gray-700">{n.scope}</strong>
                    {n.scope === "ward" && n.ward_ids?.length ? ` (${n.ward_ids.length} ward${n.ward_ids.length > 1 ? "s" : ""})` : ""}
                    {n.scope === "village" && n.village_ids?.length ? ` (${n.village_ids.length} village${n.village_ids.length > 1 ? "s" : ""})` : ""}
                  </span>
                  <span>Recipients: <strong className="text-gray-700">{n.recipients_count ?? "—"}</strong></span>
                  <span>Status: <span className="pill pill-resolved">{n.delivery_status || "Delivered"}</span></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PushDiagnostics() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testingOwn, setTestingOwn] = useState(false);
  const [sendForm, setSendForm] = useState({ user_id: "", title: "JanSetu test notification", body: "This is a test push notification from the admin panel." });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/push/status").then((r) => setStatus(r.data)).catch(() => setStatus(null)).finally(() => setLoading(false));
  }, []);

  const testOwn = async () => {
    setTestingOwn(true);
    try {
      const r = await api.post("/push/test");
      if (r.data.mode === "development") {
        toast.info("DEV mode — no real push sent (check backend logs). Register FCM_SERVICE_ACCOUNT_JSON to enable real delivery.");
      } else if (r.data.delivered_to > 0) {
        toast.success(`Test push sent to ${r.data.delivered_to} of your device(s).`);
      } else if (r.data.inbox_only) {
        toast.info("Inbox entry created but no device tokens registered for your account.");
      } else {
        toast.warning("Sent but 0 delivered — check your device tokens.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Test push failed");
    } finally {
      setTestingOwn(false);
    }
  };

  const sendToUser = async () => {
    if (!sendForm.user_id.trim()) return toast.error("Enter a user ID");
    if (!sendForm.title.trim() || !sendForm.body.trim()) return toast.error("Title and body required");
    setSending(true);
    try {
      const r = await api.post("/push/send-to-user", sendForm);
      const name = r.data.target_name ? ` (${r.data.target_name})` : "";
      if (r.data.mode === "development") {
        toast.info(`DEV mode — no real push sent to user${name}. Backend logged the delivery.`);
      } else if (r.data.delivered_to > 0) {
        toast.success(`Push delivered to ${r.data.delivered_to} device(s) for user${name}.`);
      } else if (r.data.inbox_only) {
        toast.info(`Inbox entry created for user${name} but no device tokens registered.`);
      } else {
        toast.warning(`Sent but 0 delivered for user${name}. They may not have enabled push.`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5" data-testid="push-diagnostics">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={18} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">Push notification diagnostics</h3>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400">Loading status…</div>
      ) : status ? (
        <div className="flex flex-wrap gap-3 mb-4">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${status.fcm_configured ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
            <span className={`w-2 h-2 rounded-full ${status.fcm_configured ? "bg-green-500" : "bg-amber-400"}`} />
            {status.fcm_configured ? "FCM live" : "DEV mode (no real delivery)"}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            <Users size={12} />
            {(status.registered_tokens ?? status.total_registered_tokens ?? 0)} token{(status.registered_tokens ?? status.total_registered_tokens ?? 0) !== 1 ? "s" : ""} registered in this portal
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
            {status.your_registered_tokens} token{status.your_registered_tokens !== 1 ? "s" : ""} on your account
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 mb-4">Could not load push status.</div>
      )}

      {!status?.fcm_configured && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
          <strong>FCM not configured.</strong> Set the <code>FCM_SERVICE_ACCOUNT_JSON</code> environment secret (Firebase service account JSON) to enable real push delivery. In dev mode, notifications are saved to the inbox only.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Button size="sm" variant="outline" onClick={testOwn} disabled={testingOwn} data-testid="push-test-self">
          <Send size={13} className="mr-1" />
          {testingOwn ? "Sending…" : "Send test to my devices"}
        </Button>
        <span className="text-xs text-gray-400">Sends a push to all your registered browser sessions.</span>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Send test to a specific citizen</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3 space-y-1">
            <Label className="text-xs text-gray-500">Citizen user ID</Label>
            <Input
              data-testid="push-send-user-id"
              placeholder="Paste the citizen's user ID from the Citizen Manager"
              value={sendForm.user_id}
              onChange={(e) => setSendForm((f) => ({ ...f, user_id: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs text-gray-500">Title</Label>
            <Input
              data-testid="push-send-title"
              value={sendForm.title}
              onChange={(e) => setSendForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Body</Label>
            <Input
              data-testid="push-send-body"
              value={sendForm.body}
              onChange={(e) => setSendForm((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-3 bg-[#0A1128] text-white hover:opacity-90"
          onClick={sendToUser}
          disabled={sending}
          data-testid="push-send-to-user-btn"
        >
          <Send size={13} className="mr-1" />
          {sending ? "Sending…" : "Send test push"}
        </Button>
      </div>
    </div>
  );
}

function Composer({ onCreated }) {
  const [form, setForm] = useState({
    title: "", body: "", notif_type: "Important Announcement",
    scope: "all", ward_ids: [], village_ids: [],
  });
  const [areas, setAreas] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/areas").then((r) => setAreas(r.data || [])).catch(() => setAreas([]));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleId = (key, id) => setForm((f) => {
    const list = new Set(f[key] || []);
    if (list.has(id)) list.delete(id); else list.add(id);
    return { ...f, [key]: Array.from(list) };
  });

  const wards = areas.filter((a) => a.kind === "ward");
  const villages = areas.filter((a) => a.kind === "village");

  const send = async () => {
    if (!form.title || !form.body) return toast.error("Title and body required");
    if (form.scope === "ward" && form.ward_ids.length === 0) return toast.error("Select at least one ward");
    if (form.scope === "village" && form.village_ids.length === 0) return toast.error("Select at least one village");
    setSubmitting(true);
    try {
      const r = await api.post("/notifications", form);
      onCreated(r.data);
      toast.success(`Notification sent to ${r.data.recipients_count ?? 0} citizens`);
      setForm({ title: "", body: "", notif_type: "Important Announcement", scope: "all", ward_ids: [], village_ids: [] });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5" data-testid="notif-composer">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">Compose notification</h3>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Type</Label>
          <Select value={form.notif_type} onValueChange={(v) => upd("notif_type", v)}>
            <SelectTrigger data-testid="notif-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["Politician Visit", "Public Meeting", "Health Camp", "Government Scheme", "Emergency Notice", "Important Announcement"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Title</Label>
          <Input data-testid="notif-title" value={form.title} onChange={(e) => upd("title", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Message</Label>
          <Textarea data-testid="notif-body" rows={3} value={form.body} onChange={(e) => upd("body", e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Target audience</Label>
          <Select value={form.scope} onValueChange={(v) => upd("scope", v)}>
            <SelectTrigger data-testid="notif-scope"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All citizens in constituency</SelectItem>
              <SelectItem value="ward">Specific wards</SelectItem>
              <SelectItem value="village">Specific villages</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.scope === "ward" && (
          <div className="sm:col-span-2 space-y-2" data-testid="notif-wards-picker">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Wards ({form.ward_ids.length} selected)</Label>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-md">
              {wards.length === 0 && <span className="text-xs text-gray-400">No wards configured yet.</span>}
              {wards.map((w) => {
                const on = form.ward_ids.includes(w.id);
                return (
                  <button
                    type="button"
                    key={w.id}
                    data-testid={`notif-ward-${w.id}`}
                    onClick={() => toggleId("ward_ids", w.id)}
                    className={`px-3 py-1 text-xs rounded-full border ${on ? "bg-[#0A1128] text-white border-[#0A1128]" : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"}`}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {form.scope === "village" && (
          <div className="sm:col-span-2 space-y-2" data-testid="notif-villages-picker">
            <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Villages ({form.village_ids.length} selected)</Label>
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-2 border border-gray-200 rounded-md">
              {villages.length === 0 && <span className="text-xs text-gray-400">No villages configured yet.</span>}
              {villages.map((v) => {
                const on = form.village_ids.includes(v.id);
                return (
                  <button
                    type="button"
                    key={v.id}
                    data-testid={`notif-village-${v.id}`}
                    onClick={() => toggleId("village_ids", v.id)}
                    className={`px-3 py-1 text-xs rounded-full border ${on ? "bg-[#0A1128] text-white border-[#0A1128]" : "bg-white text-gray-700 border-gray-300 hover:border-gray-500"}`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={send} data-testid="notif-send" disabled={submitting}>
        {submitting ? "Sending…" : "Send notification"}
      </Button>
    </div>
  );
}
