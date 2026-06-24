import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, EmptyState } from "../components/Common";
import { Bell } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/notifications").then((r) => setItems(r.data));
  }, []);
  const canCompose = ["pa", "politician", "admin"].includes(user?.role);

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle="Targeted alerts from your representative's office">Notifications</SectionTitle>

      {canCompose && (
        <Composer onCreated={(n) => setItems((x) => [n, ...x])} />
      )}

      {items.length === 0 ? (
        <EmptyState title="No notifications" hint="When your office sends announcements, they will appear here." />
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} className="bg-white border border-gray-200 rounded-lg p-5">
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
                  <span>Target: <strong className="text-gray-700">{n.scope}</strong></span>
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

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

function Composer({ onCreated }) {
  const [form, setForm] = useState({ title: "", body: "", notif_type: "Important Announcement", scope: "all" });
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const send = async () => {
    if (!form.title || !form.body) return toast.error("Title and body required");
    try {
      const r = await api.post("/notifications", form);
      onCreated(r.data);
      toast.success("Notification sent");
      setForm({ title: "", body: "", notif_type: "Important Announcement", scope: "all" });
    } catch {
      toast.error("Failed");
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
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
      </div>
      <Button className="mt-4 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={send} data-testid="notif-send">Send to all citizens</Button>
    </div>
  );
}
