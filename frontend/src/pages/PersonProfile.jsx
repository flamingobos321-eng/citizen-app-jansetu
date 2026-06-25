import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fileUrl } from "../lib/api";
import { useAuth } from "../lib/auth";
import { SectionTitle, StatusPill } from "../components/Common";
import {
  Phone, MessageSquare, Copy, ArrowLeft, User, Heart, Cake, Flame,
  Briefcase, Users, Plus, Trash2, Search, X, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const age = (dob) => {
  if (!dob) return null;
  try { return Math.floor((Date.now() - new Date(dob)) / (365.25 * 86400000)); } catch { return null; }
};

// Group relations into family-tree sections for cleaner display.
const RELATION_GROUPS = [
  { key: "parents", label: "Parents", types: ["Father", "Mother"] },
  { key: "spouse", label: "Spouse", types: ["Husband", "Wife"] },
  { key: "children", label: "Children", types: ["Son", "Daughter"] },
  { key: "siblings", label: "Siblings", types: ["Brother", "Sister"] },
  { key: "grandparents", label: "Grandparents", types: ["Grandfather", "Grandmother"] },
  { key: "grandchildren", label: "Grandchildren", types: ["Grandson", "Granddaughter"] },
  { key: "extended", label: "Extended Family", types: ["Uncle", "Aunt", "Nephew", "Niece", "Cousin", "Other"] },
];

export default function PersonProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [areas, setAreas] = useState([]);
  const [relTypes, setRelTypes] = useState([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);

  const canEdit = ["pa", "admin"].includes(user?.role);

  const load = () => {
    api.get(`/persons/${id}`).then((r) => setData(r.data));
  };

  useEffect(() => {
    load();
    api.get("/areas").then((r) => setAreas(r.data));
    api.get("/meta/relation-types").then((r) => setRelTypes(r.data.relation_types || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  const p = data.person;
  const areaName = (i) => areas.find((a) => a.id === i)?.name || "—";
  const deceased = p.status === "deceased";
  const total = data.issues.length;
  const resolved = data.issues.filter((i) => ["Resolved", "Verified"].includes(i.status)).length;
  const pending = total - resolved;
  const copyMobile = () => { navigator.clipboard.writeText(p.mobile || ""); toast.success("Mobile copied"); };

  const deleteRelationship = async (rid) => {
    if (!window.confirm("Remove this relationship? This cannot be undone.")) return;
    try {
      await api.delete(`/relationships/${rid}`);
      toast.success("Relationship removed");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to remove");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up max-w-6xl">
      <Link to="/app/citizens" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" data-testid="back-citizens"><ArrowLeft size={16} /> Back</Link>

      {/* TRANSFER BANNER — shown when the V1 user row was transferred OUT of
          the staff's tenant. Indicates read-only historical view. */}
      {data.transfer_banner && data.transfer_banner.kind === "transferred_out" && (
        <div
          data-testid="transferred-out-banner"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <svg className="w-5 h-5 text-amber-700 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <div className="text-sm flex-1">
            <div className="font-semibold text-amber-900">
              Transferred to {data.transfer_banner.to_organisation?.constituency_name || data.transfer_banner.to_organisation?.slug || "another constituency"} — read only
            </div>
            <div className="text-amber-800 mt-0.5">
              This citizen's records here are preserved as historical data.
              {data.transfer_banner.transferred_at && (
                <span> Transfer date: <span className="font-medium">{new Date(data.transfer_banner.transferred_at).toLocaleDateString()}</span>.</span>
              )}
              {data.transfer_banner.reason && (
                <span> Reason: <span className="font-medium">{data.transfer_banner.reason}</span>.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-start gap-6 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-[#0A1128] text-white flex items-center justify-center text-2xl font-heading font-bold">
          {p.profile_photo ? <img src={fileUrl(p.profile_photo)} alt="" className="w-full h-full object-cover rounded-full" /> : p.name?.[0]}
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
        <div className="flex gap-2 flex-wrap">
          {!deceased && p.mobile && (
            <>
              <a href={`tel:${p.mobile}`} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="call-btn"><Phone size={16} /></a>
              <a href={`sms:${p.mobile}`} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="sms-btn"><MessageSquare size={16} /></a>
              <a href={`https://wa.me/91${p.mobile}`} target="_blank" rel="noreferrer" className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 text-xs font-bold">WA</a>
              <button onClick={copyMobile} className="p-2.5 rounded-md border border-gray-200 hover:bg-gray-50" data-testid="copy-mobile"><Copy size={16} /></button>
            </>
          )}
          {canEdit && (
            <button
              onClick={() => setOpenStatus(true)}
              className="px-3 py-2 text-xs font-semibold rounded-md border border-gray-200 hover:bg-gray-50"
              data-testid="edit-status-btn"
            >
              {deceased ? "Edit Status" : "Mark Deceased"}
            </button>
          )}
        </div>
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
            {p.political_notes && <p className="text-sm text-gray-700 mt-3 italic">&ldquo;{p.political_notes}&rdquo;</p>}
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
                    <div className="text-xs text-gray-500 mt-0.5">{s.occurred_at?.slice(0, 10)} · {s.worker_name || "—"}</div>
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

          {/* FAMILY RELATIONSHIPS MODULE */}
          <div className="bg-white border border-gray-200 rounded-lg p-5" data-testid="relationships-card">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#0A1128]" />
                <h3 className="font-heading font-semibold text-gray-900">Family Relationships ({data.relationships.length})</h3>
              </div>
              {canEdit && (
                <button
                  onClick={() => setOpenAdd(true)}
                  data-testid="add-relationship-btn"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90"
                >
                  <Plus size={14} /> Add
                </button>
              )}
            </div>

            {data.relationships.length === 0 ? (
              <p className="text-sm text-gray-500">No family relationships recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {RELATION_GROUPS.map((g) => {
                  const items = data.relationships.filter((r) => g.types.includes(r.display_type || r.type));
                  if (items.length === 0) return null;
                  return (
                    <div key={g.key}>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1.5">{g.label}</div>
                      <div className="divide-y divide-gray-100">
                        {items.map((r) => <RelationRow key={r.id} r={r} canEdit={canEdit} onDelete={() => deleteRelationship(r.id)} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {openAdd && (
        <AddRelationshipDialog
          person={p}
          relTypes={relTypes}
          onClose={() => setOpenAdd(false)}
          onSaved={() => { setOpenAdd(false); load(); }}
        />
      )}

      {openStatus && (
        <PersonStatusDialog
          person={p}
          onClose={() => setOpenStatus(false)}
          onSaved={() => { setOpenStatus(false); load(); }}
        />
      )}
    </div>
  );
}

const RelationRow = ({ r, canEdit, onDelete }) => {
  const otherDeceased = r.other?.status === "deceased";
  const displayType = r.display_type || r.type;
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2">
        {r.other ? (
          <Link to={`/app/persons/${r.other.id}`} className="font-semibold text-sm text-[#0A1128] hover:underline truncate" data-testid={`rel-link-${r.id}`}>{r.other.name}</Link>
        ) : (
          <span className="font-semibold text-sm text-gray-400">Unknown person</span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="pill pill-info" data-testid={`rel-type-${r.id}`}>{displayType}</span>
          {canEdit && (
            <button
              onClick={onDelete}
              data-testid={`rel-delete-${r.id}`}
              title="Remove relationship"
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2">
        {r.other?.mobile && <span>{r.other.mobile}</span>}
        {otherDeceased && <span className="text-red-700">· Deceased</span>}
        {r.since && <span>· Since {r.since}</span>}
      </div>
      {r.notes && <div className="text-xs text-gray-600 mt-1 italic">&ldquo;{r.notes}&rdquo;</div>}
    </div>
  );
};

function AddRelationshipDialog({ person, relTypes, onClose, onSaved }) {
  const [query, setQuery] = useState("");
  const [allCitizens, setAllCitizens] = useState([]);
  const [selected, setSelected] = useState(null);
  const [type, setType] = useState("");
  const [since, setSince] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/users", { params: { role: "citizen" } }).then((r) => setAllCitizens(r.data || []));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allCitizens
      .filter((u) => u.id !== person.id)
      .filter((u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.mobile || "").toLowerCase().includes(q) ||
        (u.house_number || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, allCitizens, person.id]);

  const save = async () => {
    if (!selected || !type) {
      toast.error("Please choose a person and relation type");
      return;
    }
    setSaving(true);
    try {
      // Stored as: person_a is `type` of person_b.
      // The user is recording: <selected person> is <type> of <current person>.
      await api.post("/relationships", {
        person_a: selected.id,
        person_b: person.id,
        type,
        since: since.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success("Relationship added");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add relationship");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()} data-testid="add-rel-dialog">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold text-gray-900">Add Family Relationship</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="text-xs text-gray-500 mb-4">
          Recording <span className="font-semibold text-gray-700">someone</span> is a relation of <span className="font-semibold text-gray-700">{person.name}</span>.
        </div>

        {/* Person picker */}
        <div className="mb-4">
          <Label>Person</Label>
          {selected ? (
            <div className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
              <div>
                <div className="font-semibold text-sm text-gray-900">{selected.name}</div>
                <div className="text-xs text-gray-500">{selected.mobile || "—"}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-gray-800" data-testid="change-person-btn">Change</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  data-testid="rel-person-search"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128]"
                  placeholder="Search by name, mobile, house #"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {query && results.length > 0 && (
                <div className="border border-gray-200 rounded-md mt-1 max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelected(u); setQuery(""); }}
                      data-testid={`rel-result-${u.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="font-semibold text-sm text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.mobile || "—"} {u.status === "deceased" && "· Deceased"}</div>
                    </button>
                  ))}
                </div>
              )}
              {query && results.length === 0 && (
                <div className="text-xs text-gray-500 mt-2">No matching citizens found.</div>
              )}
            </>
          )}
        </div>

        {/* Relation type */}
        <div className="mb-4">
          <Label>Relationship</Label>
          <div className="text-[11px] text-gray-500 mb-1">{selected?.name ? <>{selected.name} is the</> : "Selected person is the"} ___ of {person.name}.</div>
          <select
            data-testid="rel-type-select"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128] bg-white"
          >
            <option value="">— Select relationship —</option>
            {relTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Since Year */}
        <div className="mb-4">
          <Label>Since Year <span className="font-normal text-gray-400">(optional)</span></Label>
          <input
            data-testid="rel-since"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            placeholder="e.g. 1994"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128]"
          />
        </div>

        {/* Notes */}
        <div className="mb-5">
          <Label>Notes <span className="font-normal text-gray-400">(optional)</span></Label>
          <textarea
            data-testid="rel-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Family connected since Shankarrao Kolhe era."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !selected || !type}
            data-testid="rel-save-btn"
            className="px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Relationship"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonStatusDialog({ person, onClose, onSaved }) {
  const [status, setStatus] = useState(person.status || "alive");
  const [dateOfDeath, setDateOfDeath] = useState(person.date_of_death || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { status };
      if (status === "deceased") {
        payload.date_of_death = dateOfDeath || null;
      } else {
        payload.date_of_death = null;
      }
      await api.put(`/persons/${person.id}`, payload);
      toast.success("Status updated");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()} data-testid="status-dialog">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg font-bold text-gray-900">Update Person Status</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 flex gap-2 text-xs text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>Marking deceased preserves all relationships and history. This is reversible.</span>
        </div>

        <div className="mb-4">
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            data-testid="status-select"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128] bg-white"
          >
            <option value="alive">Alive</option>
            <option value="deceased">Deceased</option>
          </select>
        </div>

        {status === "deceased" && (
          <div className="mb-5">
            <Label>Date of Death <span className="font-normal text-gray-400">(optional)</span></Label>
            <input
              type="date"
              value={dateOfDeath}
              onChange={(e) => setDateOfDeath(e.target.value)}
              data-testid="dod-input"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0A1128]/20 focus:border-[#0A1128]"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-md border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving} data-testid="status-save-btn" className="px-4 py-2 text-sm font-semibold rounded-md bg-[#0A1128] text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, icon: Icon, children }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-5">
    <div className="flex items-center gap-2 mb-3"><Icon size={16} className="text-[#0A1128]" /><h3 className="font-heading font-semibold text-gray-900">{title}</h3></div>
    {children}
  </div>
);
const Grid = ({ children }) => <div className="grid sm:grid-cols-2 gap-3">{children}</div>;
const Field = ({ label, value }) => (<div><div className="text-xs uppercase tracking-wider font-bold text-gray-500">{label}</div><div className="text-sm text-gray-900 mt-0.5">{value || "—"}</div></div>);
const Stat = ({ label, value, c }) => (<div className="bg-gray-50 border border-gray-200 rounded-md p-3"><div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{label}</div><div className={`font-heading text-2xl font-bold mt-0.5 ${c}`}>{value}</div></div>);
const Label = ({ children }) => <div className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">{children}</div>;
