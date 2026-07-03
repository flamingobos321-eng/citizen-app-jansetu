import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Phone, Mail, Sparkles } from "lucide-react";

export const CONTACT = {
  name: "Vikrant Adams",
  mobile: "7709080733",
  email: "hello@jansetu.in",
};

const TITLES = {
  demo: { title: "Book a Demo", desc: "See JanSetu in action with a 30-minute walkthrough tailored to your office." },
  trial: { title: "Request Free Trial", desc: "Get a sandboxed portal for your constituency to explore JanSetu risk-free." },
  sales: { title: "Contact Sales", desc: "Talk to our team about pricing, onboarding and multi-office deployments." },
};

/**
 * ContactDialog — single form component powering Book Demo / Request Free Trial
 * / Contact Sales. Posts to POST /api/leads (public endpoint).
 */
export function ContactDialog({ open, onOpenChange, leadType = "demo" }) {
  const meta = TITLES[leadType] || TITLES.demo;
  const [form, setForm] = useState({ name: "", organisation: "", role: "", email: "", mobile: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) { setForm({ name: "", organisation: "", role: "", email: "", mobile: "", message: "" }); setDone(false); }
  }, [open, leadType]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email || !form.mobile) {
      return toast.error("Name, email and mobile are required");
    }
    setSubmitting(true);
    try {
      await api.post("/leads", {
        lead_type: leadType,
        ...form,
        source_url: typeof window !== "undefined" ? window.location.href : null,
      });
      setDone(true);
      toast.success("Thank you — our team will get back to you shortly.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to submit. Please call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid={`lead-dialog-${leadType}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#0A1128]" /> {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.desc}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-6 text-center space-y-3" data-testid="lead-success">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">✓</div>
            <div className="font-heading font-semibold text-gray-900">We&apos;ve received your request.</div>
            <div className="text-sm text-gray-600">
              Meanwhile, feel free to reach out directly:
            </div>
            <div className="text-sm">
              <div className="font-semibold text-gray-900">{CONTACT.name}</div>
              <a href={`tel:+91${CONTACT.mobile}`} className="text-[#0A1128] font-semibold inline-flex items-center gap-2 mt-1">
                <Phone size={14} /> +91 {CONTACT.mobile}
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 py-2">
              <Field label="Full Name *">
                <Input data-testid="lead-name" value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Your name" />
              </Field>
              <Field label="Organisation">
                <Input data-testid="lead-organisation" value={form.organisation} onChange={(e) => upd("organisation", e.target.value)} placeholder="MLA Office / Party / NGO" />
              </Field>
              <Field label="Your Role">
                <Input data-testid="lead-role" value={form.role} onChange={(e) => upd("role", e.target.value)} placeholder="MLA, PA, Admin, etc." />
              </Field>
              <Field label="Email *">
                <Input type="email" data-testid="lead-email" value={form.email} onChange={(e) => upd("email", e.target.value)} placeholder="you@office.gov.in" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Mobile *">
                  <Input inputMode="numeric" data-testid="lead-mobile" value={form.mobile} onChange={(e) => upd("mobile", e.target.value.replace(/\D/g, "").slice(0, 15))} placeholder="10-digit mobile" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={leadType === "sales" ? "What would you like to know?" : "Anything you'd like us to know?"}>
                  <Textarea data-testid="lead-message" rows={3} value={form.message} onChange={(e) => upd("message", e.target.value)} placeholder="Constituency size, timelines, specific requirements…" />
                </Field>
              </div>
            </div>

            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 flex items-center justify-between">
              <span>Prefer to talk?</span>
              <a href={`tel:+91${CONTACT.mobile}`} className="font-semibold text-[#0A1128] inline-flex items-center gap-2">
                <Phone size={12} /> {CONTACT.name} · +91 {CONTACT.mobile}
              </a>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="lead-cancel">Cancel</Button>
              <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={submit} disabled={submitting} data-testid="lead-submit">
                {submitting ? "Sending…" : "Submit request"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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

// Small badge used in the Landing footer / hero to surface direct contact.
export function DirectContactBar({ className = "" }) {
  return (
    <div className={`inline-flex items-center gap-2 text-sm ${className}`} data-testid="direct-contact-bar">
      <Phone size={14} className="text-[#0A1128]" />
      <span className="text-gray-600">Talk to</span>
      <a href={`tel:+91${CONTACT.mobile}`} className="font-semibold text-[#0A1128]">
        {CONTACT.name} — +91 {CONTACT.mobile}
      </a>
    </div>
  );
}
