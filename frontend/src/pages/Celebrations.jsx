import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { SectionTitle, StatCard, EmptyState } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { Phone, MessageSquare, Cake, Heart, Flame, Pencil } from "lucide-react";

const age = (dob) => { if (!dob) return null; try { return Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)); } catch { return null; } };

export default function Celebrations() {
  const [data, setData] = useState({ birthdays: { today: [], upcoming: [] }, anniversaries: { today: [], upcoming: [] }, remembrance: { today: [], upcoming: [] } });
  const [areas, setAreas] = useState([]);

  const load = () => api.get("/dashboard/celebrations?days=7").then((r) => setData(r.data));
  useEffect(() => { load(); api.get("/areas").then((r) => setAreas(r.data)); }, []);

  const areaName = (id) => areas.find((a) => a.id === id)?.name || "—";

  return (
    <div className="space-y-8 animate-fade-up">
      <SectionTitle subtitle="Never miss a wish. Political CRM — Phase 1.">Celebrations</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Today Birthdays" value={data.birthdays.today.length} accent="text-[#0A1128]" testId="s-bd-today" />
        <StatCard label="Upcoming Birthdays" value={data.birthdays.upcoming.length} testId="s-bd-up" />
        <StatCard label="Today Anniversaries" value={data.anniversaries.today.length} accent="text-[#10B981]" testId="s-an-today" />
        <StatCard label="Upcoming Anniv." value={data.anniversaries.upcoming.length} testId="s-an-up" />
        <StatCard label="Remembrance" value={data.remembrance.today.length + data.remembrance.upcoming.length} accent="text-[#B45309]" testId="s-rem" />
      </div>

      <Section title="Today's Birthdays" icon={Cake} items={data.birthdays.today} renderRow={(p) => <PersonRow p={p} extra={`Age ${age(p.dob)}`} areaName={areaName} onUpdated={load} />} />
      <Section title="Upcoming Birthdays (7 days)" icon={Cake} items={data.birthdays.upcoming} renderRow={(p) => <PersonRow p={p} extra={`in ${p.in_days} day(s) · Age ${age(p.dob)}`} areaName={areaName} onUpdated={load} />} />
      <Section title="Today's Anniversaries" icon={Heart} items={data.anniversaries.today} renderRow={(p) => <PersonRow p={p} extra="Today" areaName={areaName} onUpdated={load} />} />
      <Section title="Upcoming Anniversaries (7 days)" icon={Heart} items={data.anniversaries.upcoming} renderRow={(p) => <PersonRow p={p} extra={`in ${p.in_days} day(s)`} areaName={areaName} onUpdated={load} />} />
      <Section title="Deceased Remembrance" icon={Flame} items={[...data.remembrance.today, ...data.remembrance.upcoming]} renderRow={(p) => <PersonRow p={p} extra={`DOD ${p.date_of_death}${p.in_days ? ` · in ${p.in_days} day(s)` : " · Today"}`} areaName={areaName} onUpdated={load} deceased />} />
    </div>
  );
}

function Section({ title, icon: Icon, items, renderRow }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
        <Icon size={18} className="text-[#0A1128]" />
        <h3 className="font-heading font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500 ml-auto">{items.length}</span>
      </div>
      {items.length === 0 ? <div className="p-6 text-sm text-gray-500">Nothing scheduled.</div> : <div className="divide-y divide-gray-100">{items.map((p) => <div key={p.id} className="px-5 py-4">{renderRow(p)}</div>)}</div>}
    </div>
  );
}

function PersonRow({ p, extra, areaName, onUpdated, deceased }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap" data-testid={`celeb-row-${p.id}`}>
      <div className="min-w-0">
        <div className="font-semibold text-sm text-gray-900">{p.name} {deceased && <span className="pill pill-neutral ml-2">Deceased</span>}</div>
        <div className="text-xs text-gray-500 mt-0.5">{extra} · {p.mobile || "no mobile"} · Ward {areaName(p.ward_id)} · Village {areaName(p.village_id)}</div>
      </div>
      <div className="flex items-center gap-2">
        {p.mobile && !deceased && (
          <>
            <a href={`tel:${p.mobile}`} className="p-2 rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`call-${p.id}`}><Phone size={14} /></a>
            <a href={`sms:${p.mobile}?body=${encodeURIComponent('Many happy returns of the day from JANSETU office')}`} className="p-2 rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`sms-${p.id}`}><MessageSquare size={14} /></a>
            <a href={`https://wa.me/91${p.mobile}?text=${encodeURIComponent('Warm wishes from JANSETU office')}`} target="_blank" rel="noreferrer" className="p-2 rounded-md border border-gray-200 hover:bg-gray-50 text-xs font-bold" data-testid={`wa-${p.id}`}>WA</a>
          </>
        )}
        <EditPersonDialog person={p} onSaved={onUpdated} />
      </div>
    </div>
  );
}

function EditPersonDialog({ person, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ dob: person.dob || "", anniversary: person.anniversary || "", date_of_death: person.date_of_death || "", status: person.status || "alive", political_notes: person.political_notes || "" });
  const save = async () => {
    try {
      await api.put(`/persons/${person.id}`, form);
      toast.success("Saved");
      setOpen(false);
      onSaved();
    } catch { toast.error("Failed"); }
  };
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-2 rounded-md border border-gray-200 hover:bg-gray-50" data-testid={`edit-${person.id}`}><Pencil size={14} /></button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader><DialogTitle>Edit {person.name}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <F label="Birthday"><Input type="date" value={form.dob} onChange={(e) => upd("dob", e.target.value)} data-testid="edit-dob" /></F>
          <F label="Anniversary"><Input type="date" value={form.anniversary} onChange={(e) => upd("anniversary", e.target.value)} data-testid="edit-anniv" /></F>
          <F label="Status">
            <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" value={form.status} onChange={(e) => upd("status", e.target.value)} data-testid="edit-status">
              <option value="alive">Alive</option><option value="deceased">Deceased</option>
            </select>
          </F>
          <F label="Date of Death"><Input type="date" value={form.date_of_death} onChange={(e) => upd("date_of_death", e.target.value)} data-testid="edit-dod" /></F>
          <div className="sm:col-span-2"><F label="Political Notes"><Textarea rows={3} value={form.political_notes} onChange={(e) => upd("political_notes", e.target.value)} data-testid="edit-notes" /></F></div>
        </div>
        <Button onClick={save} className="bg-[#0A1128] hover:bg-[#0A1128]/90 text-white mt-3" data-testid="edit-save">Save</Button>
      </DialogContent>
    </Dialog>
  );
}

const F = ({ label, children }) => (<div className="space-y-1.5"><Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>{children}</div>);
