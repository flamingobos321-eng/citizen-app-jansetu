import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import { Users, UserPlus, Check, X, Clock, Inbox } from "lucide-react";
import { toast } from "sonner";

const RELATIONS = [
  "Father", "Mother", "Son", "Daughter", "Brother", "Sister",
  "Husband", "Wife", "Grandfather", "Grandmother", "Grandson", "Granddaughter",
  "Uncle", "Aunt", "Nephew", "Niece", "Cousin", "Other",
];

export function FamilyLinkCard() {
  const [members, setMembers] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ relation_type: "Father", mobile: "", target_name: "", marriage_anniversary: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.get("/family/members").then((r) => setMembers(r.data || [])).catch(() => setMembers([]));
    api.get("/family/invitations").then((r) => {
      setOutgoing(r.data.outgoing || []);
      setIncoming(r.data.incoming || []);
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const submitLink = async () => {
    if (!form.mobile || form.mobile.length < 10) return toast.error("Enter a valid mobile number");
    if (!form.relation_type) return toast.error("Select a relationship");
    setSubmitting(true);
    try {
      const r = await api.post("/family/link", {
        relation_type: form.relation_type,
        mobile: form.mobile.trim(),
        target_name: form.target_name || undefined,
        marriage_anniversary: form.marriage_anniversary || undefined,
      });
      if (r.data.linked) {
        toast.success(`Linked with ${r.data.target?.name || "family member"}.`);
      } else {
        toast.success("Invitation sent — they'll be linked automatically when they register.");
      }
      setOpen(false);
      setForm({ relation_type: "Father", mobile: "", target_name: "", marriage_anniversary: "" });
      load();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to link family member");
    } finally {
      setSubmitting(false);
    }
  };

  const accept = async (invId) => {
    try {
      await api.post(`/family/invitations/${invId}/accept`);
      toast.success("Family link created.");
      load();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not accept invitation");
    }
  };
  const decline = async (invId) => {
    try {
      await api.post(`/family/invitations/${invId}/decline`);
      toast.info("Declined.");
      load();
    } catch { toast.error("Could not decline"); }
  };
  const cancel = async (invId) => {
    try {
      await api.post(`/family/invitations/${invId}/cancel`);
      toast.info("Cancelled.");
      load();
    } catch { toast.error("Could not cancel"); }
  };

  const isSpouse = ["Husband", "Wife"].includes(form.relation_type);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg" data-testid="family-link-card">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0A1128]" />
            <h3 className="font-heading font-semibold text-gray-900">Family members</h3>
          </div>
          <Button
            size="sm"
            className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
            onClick={() => setOpen(true)}
            data-testid="family-link-btn"
          >
            <UserPlus size={14} className="mr-2" /> Link Family Member
          </Button>
        </div>
        <div className="divide-y divide-gray-100">
          {members.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
            <div className="p-6 text-sm text-gray-500">
              Link parents, spouse, children so your family history is preserved across constituency transfers.
            </div>
          )}
          {members.length > 0 && (
            <div className="p-4 space-y-2" data-testid="family-members-list">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 flex items-center gap-1">
                <Users size={11} /> Linked family ({members.length})
              </div>
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2"
                  data-testid={`family-member-${m.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#0A1128] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {(m.other_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-gray-900 truncate">{m.other_name || m.other_mobile}</div>
                    <div className="text-xs text-gray-500">{m.relation}{m.other_mobile ? ` · ${m.other_mobile}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {incoming.length > 0 && (
            <div className="p-4 space-y-2" data-testid="family-incoming-list">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 flex items-center gap-1">
                <Inbox size={11} /> Invitations for you
              </div>
              {incoming.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 flex-wrap" data-testid={`family-incoming-${inv.id}`}>
                  <div className="text-sm">
                    <span className="font-semibold">{inv.from_user_name || "Someone"}</span> wants to add you as their <span className="font-semibold">{inv.relation_type}</span>
                    {inv.from_user_mobile && (
                      <span className="text-xs text-gray-500 ml-2">· {inv.from_user_mobile}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => decline(inv.id)} data-testid={`family-decline-${inv.id}`}>
                      <X size={12} className="mr-1" /> Decline
                    </Button>
                    <Button size="sm" className="bg-[#10B981] hover:bg-[#10B981]/90 text-white" onClick={() => accept(inv.id)} data-testid={`family-accept-${inv.id}`}>
                      <Check size={12} className="mr-1" /> Accept
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="p-4 space-y-2" data-testid="family-outgoing-list">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-500 flex items-center gap-1">
                <Clock size={11} /> Pending invitations you sent
              </div>
              {outgoing.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-3 flex-wrap" data-testid={`family-outgoing-${inv.id}`}>
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">{inv.target_name || inv.target_mobile}</span> · <span className="text-gray-500">{inv.relation_type}</span> · <span className="text-gray-400">{inv.target_mobile}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => cancel(inv.id)} data-testid={`family-cancel-${inv.id}`}>
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="family-link-dialog">
          <DialogHeader>
            <DialogTitle>Link a family member</DialogTitle>
            <DialogDescription>
              Enter their mobile number. If they are already registered, the link is created immediately. Otherwise, an invitation is stored and applied automatically when they register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Relationship</Label>
              <Select value={form.relation_type} onValueChange={(v) => setForm((f) => ({ ...f, relation_type: v }))}>
                <SelectTrigger data-testid="family-relation-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Mobile *</Label>
              <Input
                data-testid="family-mobile-input"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Name (optional)</Label>
              <Input
                data-testid="family-name-input"
                placeholder="Their name (helps them recognise the request)"
                value={form.target_name}
                onChange={(e) => setForm((f) => ({ ...f, target_name: e.target.value }))}
              />
            </div>
            {isSpouse && (
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Marriage Anniversary</Label>
                <Input
                  type="date"
                  data-testid="family-anniversary-input"
                  value={form.marriage_anniversary}
                  onChange={(e) => setForm((f) => ({ ...f, marriage_anniversary: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="family-cancel-btn">Cancel</Button>
            <Button
              className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
              onClick={submitLink}
              disabled={submitting}
              data-testid="family-submit-btn"
            >
              {submitting ? "Linking…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
