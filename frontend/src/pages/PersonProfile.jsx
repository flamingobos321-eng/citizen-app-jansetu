import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { SectionTitle, StatusPill } from "../components/Common";
import { Phone, MessageSquare, Copy, ArrowLeft, User, Heart, Cake, Flame, Briefcase, Home } from "lucide-react";
import { toast } from "sonner";

const age = (dob) => { if (!dob) return null; try { return Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)); } catch { return null; }};

export default function PersonProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [areas, setAreas] = useState([]);

  useEffect(() => {
    api.get(`/persons/${id}`).then((r) => setData(r.data));
    api.get("/areas").then((r) => setAreas(r.data));
  }, [id]);

  if (!data) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  const p = data.person;
  const areaName = (i) => areas.find((a) => a.id === i)?.name || "—";
  const deceased = p.status === "deceased";
  const total = data.issues.length;
  const resolved = data.issues.filter((i) => ["Resolved", "Verified"].includes(i.status)).length;
  const pending = total - resolved;
  const copyMobile = () => { navigator.clipboard.writeText(p.mobile || ""); toast.success("Mobile copied"); };

  return (
    <div className="space-y-6 animate-fade-up max-w-6xl">
      <Link to="/app/citizens" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" data-testid="back-citizens"><ArrowLeft size={16} /> Back</Link>

      {/* HEADER */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-start gap-6 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-[#0A1128] text-white flex items-center justify-center text-2xl font-heading font-bold">
          {p.profile_photo ? <img src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${p.profile_photo}`} alt="" className="w-full h-full object-cover rounded-full" /> : p.name?.[0]}
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight">{p.name}</h1>
            <span className={deceased ? "pill pill-neutral" : "pill pill-resolved"} data-testid="person-status">{deceased ? "Deceased" : "Alive"}</span>
          </div>
          <div className="text-sm text-gray-600 mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <span>{p.mobile || "—"}</span><span>{p.gender || "—"}</span>
            {p.dob && <span>Age {age(p.dob)}</span>}
            <span>Ward {areaName(p.ward_id)}</span><span>Village {areaName(p.village_id)}</span>
            <span>HH {p.household_id ? p.household_id.slice(0, 8) : "—"}</span>
          </div>
        </div>
        {!deceased && p.mobile && (
          <div className="flex gap-2">
            <a href={`tel:${p.mobile}`} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="call-btn"><Phone size={16} /></a>
            <a href={`sms:${p.mobile}`} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="sms-btn"><MessageSquare size={16} /></a>
            <a href={`https://wa.me/91${p.mobile}`} target="_blank" rel="noreferrer" className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 text-xs font-bold">WA</a>
            <button onClick={copyMobile} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="copy-mobile"><Copy size={16} /></button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Personal Information" icon={User}>
            <Grid>
              <Field label="DOB" value={p.dob} /><Field label="Anniversary" value={p.anniversary} />
              <Field label="Occupation" value={p.occupation} /><Field label="Family Head" value={p.family_head_name} />
              <div className="sm:col-span-2"><Field label="Address" value={p.address} /></div>
              {p.notes && <div className="sm:col-span-2"><Field label="Notes" value={p.notes} /></div>}
            </Grid>
          </Card>

          <Card title="Political History" icon={Briefcase}>
            <Grid>
              <Field label="Supporter Since" value={p.supporter_since} />
              <Field label="Political Role" value={p.political_role} />
              <Field label="Influence Level" value={p.influence_level} />
            </Grid>
            {p.political_notes && <p className="text-sm text-gray-700 mt-3 italic">"{p.political_notes}"</p>}
            {(p.family_lineage || []).length > 0 && (
              <div className="mt-4 border-l-2 border-[#0A1128] pl-4 space-y-3">
                {p.family_lineage.map((e, i) => (
                  <div key={i}>
                    <div className="font-semibold text-sm text-gray-900">{e.since_year || e.era || "—"} — {e.leader_name}</div>
                    {e.notes && <div className="text-xs text-gray-500">{e.notes}</div>}
                  </div>
                ))}
              </div>
            )}
            {(!p.political_notes && (!p.family_lineage || p.family_lineage.length === 0)) && <p className="text-sm text-gray-500">No political history recorded yet.</p>}
          </Card>

          <Card title={`Service History (${data.interactions.length})`} icon={Heart}>
            {data.interactions.length === 0 ? <p className="text-sm text-gray-500">No service interactions recorded.</p> : (
              <div className="divide-y divide-gray-100">
                {data.interactions.map((s) => (
                  <div key={s.id} className="py-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="font-semibold text-sm text-gray-900">{s.interaction_type}</div>
                      <span className="pill pill-neutral">{s.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{s.occurred_at?.slice(0,10)} · {s.worker_name || "—"}</div>
                    <div className="text-sm text-gray-700 mt-1">{s.description}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={`Issue History (${total})`} icon={Cake}>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Stat label="Total" value={total} c="text-[#0A1128]" /><Stat label="Resolved" value={resolved} c="text-[#10B981]" /><Stat label="Pending" value={pending} c="text-[#B45309]" />
            </div>
            {data.issues.length === 0 ? <p className="text-sm text-gray-500">No issues raised.</p> : (
              <div className="divide-y divide-gray-100">
                {data.issues.map((i) => (
                  <Link key={i.id} to={`/app/issues/${i.id}`} className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50 -mx-2 px-2 rounded">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-500">{i.issue_code}</div>
                      <div className="font-semibold text-sm text-gray-900 truncate">{i.title}</div>
                    </div>
                    <StatusPill status={i.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {deceased && (
            <Card title="In Remembrance" icon={Flame}>
              <Field label="Date of Death" value={p.date_of_death} />
              <p className="text-xs text-gray-500 mt-2">Relationships, service history and political records remain preserved.</p>
            </Card>
          )}
          <Card title={`Relationships (${data.relationships.length})`} icon={Home}>
            {data.relationships.length === 0 ? <p className="text-sm text-gray-500">None recorded.</p> : (
              <div className="divide-y divide-gray-100">
                {data.relationships.map((r) => (
                  <div key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/app/persons/${r.other?.id}`} className="font-semibold text-sm text-[#0A1128] hover:underline">{r.other?.name || "—"}</Link>
                      <span className="pill pill-info">{r.type}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.other?.mobile || "—"} {r.other?.status === "deceased" && "· Deceased"}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, icon: Icon, children }) => (<div className="bg-white border border-gray-200 rounded-lg p-5"><div className="flex items-center gap-2 mb-3"><Icon size={16} className="text-[#0A1128]" /><h3 className="font-heading font-semibold text-gray-900">{title}</h3></div>{children}</div>);
const Grid = ({ children }) => <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
const Field = ({ label, value }) => (<div><div className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</div><div className="text-sm text-gray-900 mt-0.5">{value || "—"}</div></div>);
const Stat = ({ label, value, c }) => (<div className="bg-gray-50 border border-gray-200 rounded-md p-3"><div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</div><div className={`font-heading text-2xl font-bold mt-0.5 ${c}`}>{value}</div></div>);
