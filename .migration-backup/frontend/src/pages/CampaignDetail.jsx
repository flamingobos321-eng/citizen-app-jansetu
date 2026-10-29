import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Loader2, Download, Users,
  Settings, BarChart2, ClipboardList, CheckSquare, FileText,
  Edit2, Save, X, UserPlus,
} from "lucide-react";

const FIELD_TYPES = [
  { value: "short_text",     label: "Short Text" },
  { value: "long_text",      label: "Long Text" },
  { value: "number",         label: "Number" },
  { value: "mobile",         label: "Mobile" },
  { value: "email",          label: "Email" },
  { value: "date",           label: "Date" },
  { value: "time",           label: "Time" },
  { value: "address",        label: "Address" },
  { value: "yes_no",         label: "Yes / No" },
  { value: "single_choice",  label: "Single Choice" },
  { value: "multiple_choice",label: "Multiple Choice" },
  { value: "dropdown",       label: "Dropdown" },
  { value: "rating",         label: "Rating" },
  { value: "photo",          label: "Photo Upload" },
  { value: "file",           label: "File Upload" },
  { value: "gps",            label: "GPS Location" },
];

const TASK_STATUS_COLORS = {
  assigned:    "bg-gray-100 text-gray-700",
  accepted:    "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  on_hold:     "bg-orange-100 text-orange-700",
  completed:   "bg-green-100 text-green-700",
  cancelled:   "bg-red-100 text-red-700",
};

const TABS = [
  { id: "overview",   label: "Overview",     icon: Settings },
  { id: "form",       label: "Form Builder", icon: FileText },
  { id: "workers",    label: "Workers",      icon: Users },
  { id: "responses",  label: "Responses",    icon: ClipboardList },
  { id: "tasks",      label: "Tasks",        icon: CheckSquare },
  { id: "analytics",  label: "Analytics",    icon: BarChart2 },
];

// ── Drag-sortable form field row ───────────────────────────────────────────
function SortableFieldRow({ field, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
      <button {...attributes} {...listeners} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-gray-900">{field.label}</span>
        <span className="ml-2 text-xs text-gray-400 capitalize">{field.type.replace(/_/g, " ")}</span>
        {field.required && <span className="ml-2 text-xs text-red-500">Required</span>}
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onEdit(field)} className="p-1.5 rounded hover:bg-gray-100"><Edit2 size={14} /></button>
        <button onClick={() => onDelete(field.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ── Field editor dialog ────────────────────────────────────────────────────
function FieldEditor({ field, onSave, onClose }) {
  const [f, setF] = useState(field);
  const hasOptions = ["single_choice", "multiple_choice", "dropdown"].includes(f.type);
  const addOption = () => setF(prev => ({ ...prev, options: [...(prev.options || []), { label: "", value: "" }] }));
  const updateOption = (i, key, val) => setF(prev => {
    const opts = [...prev.options];
    opts[i] = { ...opts[i], [key]: val, ...(key === "label" ? { value: val.toLowerCase().replace(/\s+/g, "_") } : {}) };
    return { ...prev, options: opts };
  });
  const removeOption = (i) => setF(prev => ({ ...prev, options: prev.options.filter((_, idx) => idx !== i) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Field</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Field Type</Label>
            <Select value={f.type} onValueChange={v => setF(p => ({ ...p, type: v, options: [] }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Label *</Label>
            <Input value={f.label} onChange={e => setF(p => ({ ...p, label: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Placeholder</Label>
            <Input value={f.placeholder || ""} onChange={e => setF(p => ({ ...p, placeholder: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Help Text</Label>
            <Input value={f.help_text || ""} onChange={e => setF(p => ({ ...p, help_text: e.target.value }))} className="mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="req" checked={!!f.required} onChange={e => setF(p => ({ ...p, required: e.target.checked }))} />
            <label htmlFor="req" className="text-sm">Required field</label>
          </div>
          {hasOptions && (
            <div>
              <Label className="mb-2 block">Options</Label>
              <div className="space-y-2">
                {(f.options || []).map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={opt.label} onChange={e => updateOption(i, "label", e.target.value)} placeholder="Option label" />
                    <button onClick={() => removeOption(i)} className="p-2 text-red-400 hover:text-red-600"><X size={14} /></button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOption} className="w-full gap-1">
                  <Plus size={13} /> Add Option
                </Button>
              </div>
            </div>
          )}
          {f.type === "rating" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min</Label><Input type="number" value={f.min_val || 1} onChange={e => setF(p => ({ ...p, min_val: +e.target.value }))} className="mt-1" /></div>
              <div><Label>Max</Label><Input type="number" value={f.max_val || 5} onChange={e => setF(p => ({ ...p, max_val: +e.target.value }))} className="mt-1" /></div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1 bg-[#0A1128]" onClick={() => onSave(f)} disabled={!f.label}>Save Field</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Response viewer dialog ─────────────────────────────────────────────────
function ResponseViewer({ response, campaign, onClose }) {
  const fields = campaign?.form_fields || [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Response Detail</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-gray-500">Worker: </span>{response.worker_name || "—"}</div>
            <div><span className="text-gray-500">Citizen: </span>{response.citizen_name || "Anonymous"}</div>
            <div><span className="text-gray-500">Submitted: </span>{response.submitted_at?.slice(0, 16).replace("T", " ")}</div>
            <div><span className="text-gray-500">Status: </span>{response.status}</div>
          </div>
          <hr />
          {fields.map(f => (
            <div key={f.id}>
              <div className="text-xs text-gray-500 uppercase tracking-wide">{f.label}</div>
              <div className="text-sm text-gray-900 mt-0.5">
                {Array.isArray(response.responses?.[f.id])
                  ? response.responses[f.id].join(", ")
                  : response.responses?.[f.id] || "—"}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = ["admin", "super_admin", "pa", "politician"].includes(user?.role);

  const [tab, setTab] = useState("overview");
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Overview edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Form builder state
  const [fields, setFields] = useState([]);
  const [editingField, setEditingField] = useState(null);
  const [savingForm, setSavingForm] = useState(false);

  // Workers state
  const [workers, setWorkers] = useState([]);
  const [allWorkers, setAllWorkers] = useState([]);
  const [savingWorkers, setSavingWorkers] = useState(false);

  // Responses state
  const [responses, setResponses] = useState([]);
  const [respTotal, setRespTotal] = useState(0);
  const [viewingResp, setViewingResp] = useState(null);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
  const [addingTask, setAddingTask] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadCampaign = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/campaigns/${id}`);
      setCampaign(res.data);
      setEditForm(res.data);
      setFields((res.data.form_fields || []).sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch {
      toast.error("Campaign not found");
      navigate("/app/campaigns");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);

  useEffect(() => {
    if (tab === "workers" && isStaff) {
      api.get("/users", { params: { role: "worker" } }).then(r => setAllWorkers(r.data || [])).catch(() => {});
    }
    if (tab === "responses") {
      api.get(`/campaigns/${id}/responses`).then(r => { setResponses(r.data.items || []); setRespTotal(r.data.total || 0); }).catch(() => {});
    }
    if (tab === "tasks") {
      api.get(`/campaigns/${id}/tasks`).then(r => setTasks(r.data || [])).catch(() => {});
      if (isStaff) api.get("/users", { params: { role: "worker" } }).then(r => setAllWorkers(r.data || [])).catch(() => {});
    }
    if (tab === "analytics") {
      api.get(`/campaigns/${id}/analytics`).then(r => setAnalytics(r.data)).catch(() => {});
    }
  }, [tab, id, isStaff]);

  // ── Overview ────────────────────────────────────────────────────────────
  const saveOverview = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/campaigns/${id}`, editForm);
      setCampaign(res.data);
      setEditForm(res.data);
      setEditing(false);
      toast.success("Campaign updated");
    } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  // ── Form Builder ─────────────────────────────────────────────────────────
  const addField = () => {
    const newField = { id: crypto.randomUUID(), type: "short_text", label: "New Field", required: false, options: [], order: fields.length };
    setEditingField(newField);
  };

  const saveField = (f) => {
    setFields(prev => {
      const idx = prev.findIndex(x => x.id === f.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = f; return next; }
      return [...prev, f];
    });
    setEditingField(null);
  };

  const deleteField = (fieldId) => setFields(prev => prev.filter(f => f.id !== fieldId));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFields(prev => {
        const oi = prev.findIndex(f => f.id === active.id);
        const ni = prev.findIndex(f => f.id === over.id);
        return arrayMove(prev, oi, ni).map((f, i) => ({ ...f, order: i }));
      });
    }
  };

  const saveForm = async () => {
    setSavingForm(true);
    try {
      await api.put(`/campaigns/${id}`, { form_fields: fields.map((f, i) => ({ ...f, order: i })) });
      toast.success("Form saved");
    } catch { toast.error("Failed to save form"); } finally { setSavingForm(false); }
  };

  // ── Workers ───────────────────────────────────────────────────────────────
  const currentWorkerIds = campaign?.assigned_worker_ids || [];

  const toggleWorker = (wid) => {
    const next = currentWorkerIds.includes(wid)
      ? currentWorkerIds.filter(x => x !== wid)
      : [...currentWorkerIds, wid];
    setCampaign(prev => ({ ...prev, assigned_worker_ids: next }));
  };

  const saveWorkers = async () => {
    setSavingWorkers(true);
    try {
      await api.put(`/campaigns/${id}/workers`, { worker_ids: campaign.assigned_worker_ids });
      toast.success("Workers updated");
    } catch { toast.error("Failed to update workers"); } finally { setSavingWorkers(false); }
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const createTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return toast.error("Title required");
    setSavingTask(true);
    try {
      const res = await api.post(`/campaigns/${id}/tasks`, {
        ...taskForm,
        assigned_to: taskForm.assigned_to || undefined,
        due_date: taskForm.due_date || undefined,
      });
      setTasks(prev => [res.data, ...prev]);
      setTaskForm({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
      setAddingTask(false);
      toast.success("Task created");
    } catch { toast.error("Failed to create task"); } finally { setSavingTask(false); }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const res = await api.put(`/campaigns/${id}/tasks/${taskId}`, { status });
      setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
    } catch { toast.error("Failed to update task"); }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/campaigns/${id}/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success("Task deleted");
    } catch { toast.error("Failed to delete task"); }
  };

  const exportCSV = () => {
    const token = localStorage.getItem("jansetu_token");
    window.open(`/api/campaigns/${id}/export?t=${encodeURIComponent(token || "")}`, "_blank");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
  );
  if (!campaign) return null;

  const sc = { draft: "bg-gray-100 text-gray-700", active: "bg-green-100 text-green-700", completed: "bg-blue-100 text-blue-700", archived: "bg-red-100 text-red-700" };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={() => navigate("/app/campaigns")} className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-heading text-[#0A1128] truncate">{campaign.name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${sc[campaign.status] || sc.draft}`}>
              {campaign.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {campaign.campaign_type?.replace(/_/g, " ")} · {campaign.response_mode?.replace(/_/g, " ")}
          </p>
        </div>
        {isStaff && (
          <div className="flex gap-2 shrink-0">
            {tab === "responses" && (
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
                <Download size={14} /> Export CSV
              </Button>
            )}
            {isStaff && campaign.status === "draft" && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1"
                onClick={() => { api.put(`/campaigns/${id}`, { status: "active" }).then(() => { loadCampaign(); toast.success("Campaign activated"); }); }}>
                Activate
              </Button>
            )}
            {isStaff && campaign.status === "active" && (
              <Button size="sm" variant="outline"
                onClick={() => { api.put(`/campaigns/${id}`, { status: "completed" }).then(() => { loadCampaign(); toast.success("Marked as completed"); }); }}>
                Complete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-[#0A1128] text-[#0A1128]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Campaign Details</h2>
            {isStaff && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1"><Edit2 size={13} />Edit</Button>}
          </div>
          {editing ? (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editForm.name || ""} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={editForm.status || "draft"} onValueChange={v => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={editForm.priority || "medium"} onValueChange={v => setEditForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={editForm.start_date || ""} onChange={e => setEditForm(p => ({ ...p, start_date: e.target.value }))} className="mt-1" /></div>
                <div><Label>End Date</Label><Input type="date" value={editForm.end_date || ""} onChange={e => setEditForm(p => ({ ...p, end_date: e.target.value }))} className="mt-1" /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editForm.description || ""} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} className="mt-1" /></div>
              <div><Label>Objectives</Label><Textarea value={editForm.objectives || ""} onChange={e => setEditForm(p => ({ ...p, objectives: e.target.value }))} rows={2} className="mt-1" /></div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                <Button className="bg-[#0A1128] gap-1" onClick={saveOverview} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["Campaign Type", campaign.campaign_type?.replace(/_/g, " ")],
                ["Response Mode", campaign.response_mode?.replace(/_/g, " ")],
                ["Priority", campaign.priority],
                ["Status", campaign.status],
                ["Start Date", campaign.start_date || "—"],
                ["End Date", campaign.end_date || "—"],
                ["Total Responses", campaign.total_responses ?? 0],
                ["Workers Assigned", (campaign.assigned_worker_ids || []).length],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-500 uppercase tracking-wide">{k}</dt>
                  <dd className="font-medium text-gray-900 mt-0.5 capitalize">{v}</dd>
                </div>
              ))}
              {campaign.description && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500 uppercase tracking-wide">Description</dt>
                  <dd className="text-gray-900 mt-0.5">{campaign.description}</dd>
                </div>
              )}
              {campaign.objectives && (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500 uppercase tracking-wide">Objectives</dt>
                  <dd className="text-gray-900 mt-0.5">{campaign.objectives}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}

      {/* ── Form Builder Tab ─────────────────────────────────────────────── */}
      {tab === "form" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-gray-900">Form Fields</h2>
              <p className="text-xs text-gray-500 mt-0.5">Drag to reorder · Click edit to configure</p>
            </div>
            {isStaff && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addField} className="gap-1"><Plus size={13} />Add Field</Button>
                <Button size="sm" className="bg-[#0A1128] gap-1" onClick={saveForm} disabled={savingForm}>
                  {savingForm ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Form
                </Button>
              </div>
            )}
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium text-sm">No fields yet</p>
              {isStaff && <p className="text-xs mt-1">Add fields to build your form</p>}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map(f => (
                    <SortableFieldRow key={f.id} field={f} onEdit={setEditingField} onDelete={deleteField} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {editingField && (
            <FieldEditor field={editingField} onSave={saveField} onClose={() => setEditingField(null)} />
          )}
        </div>
      )}

      {/* ── Workers Tab ───────────────────────────────────────────────────── */}
      {tab === "workers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Assigned Workers ({(campaign.assigned_worker_ids || []).length})</h2>
            {isStaff && (
              <Button size="sm" className="bg-[#0A1128] gap-1" onClick={saveWorkers} disabled={savingWorkers}>
                {savingWorkers ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {allWorkers.map(w => {
              const assigned = (campaign.assigned_worker_ids || []).includes(w.id);
              return (
                <div key={w.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${assigned ? "border-[#0A1128] bg-blue-50" : "border-gray-200 bg-white"}`}>
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                    {(w.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{w.name}</div>
                    <div className="text-xs text-gray-500">{w.mobile || w.email || ""}</div>
                  </div>
                  {isStaff && (
                    <button onClick={() => toggleWorker(w.id)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${assigned ? "bg-[#0A1128] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {assigned ? "Assigned" : "Assign"}
                    </button>
                  )}
                </div>
              );
            })}
            {allWorkers.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No workers found in this constituency</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Responses Tab ─────────────────────────────────────────────────── */}
      {tab === "responses" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Responses ({respTotal})</h2>
            {user?.role === "worker" && campaign.status === "active" && (
              <Button size="sm" className="bg-[#0A1128] gap-1"
                onClick={() => navigate(`/app/campaigns/${id}/respond`)}>
                <Plus size={13} /> Add Response
              </Button>
            )}
          </div>
          {responses.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No responses yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {responses.map(r => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 cursor-pointer"
                  onClick={() => setViewingResp(r)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{r.citizen_name || "Anonymous"}</span>
                      <span className="ml-2 text-xs text-gray-500">by {r.worker_name}</span>
                    </div>
                    <div className="text-xs text-gray-400">{r.submitted_at?.slice(0, 16).replace("T", " ")}</div>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{Object.keys(r.responses || {}).length} fields answered</div>
                </div>
              ))}
            </div>
          )}
          {viewingResp && <ResponseViewer response={viewingResp} campaign={campaign} onClose={() => setViewingResp(null)} />}
        </div>
      )}

      {/* ── Tasks Tab ─────────────────────────────────────────────────────── */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Tasks ({tasks.length})</h2>
            {isStaff && !addingTask && (
              <Button size="sm" className="bg-[#0A1128] gap-1" onClick={() => setAddingTask(true)}>
                <Plus size={13} /> Add Task
              </Button>
            )}
          </div>

          {addingTask && (
            <form onSubmit={createTask} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div><Label>Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} className="mt-1" placeholder="Task title" /></div>
              <div><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} className="mt-1" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assign To</Label>
                  <Select value={taskForm.assigned_to} onValueChange={v => setTaskForm(p => ({ ...p, assigned_to: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select worker" /></SelectTrigger>
                    <SelectContent>
                      {allWorkers.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Due Date</Label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} className="mt-1" /></div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAddingTask(false)}>Cancel</Button>
                <Button type="submit" size="sm" className="bg-[#0A1128]" disabled={savingTask}>
                  {savingTask ? <Loader2 size={13} className="animate-spin mr-1" /> : null} Create Task
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{t.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLORS[t.status] || TASK_STATUS_COLORS.assigned}`}>
                        {t.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                      {t.assigned_to_name && <span>→ {t.assigned_to_name}</span>}
                      {t.due_date && <span>Due {t.due_date}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={t.status} onValueChange={v => updateTaskStatus(t.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["assigned","accepted","in_progress","on_hold","completed","cancelled"].map(s => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isStaff && (
                      <button onClick={() => deleteTask(t.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && !addingTask && (
              <div className="text-center py-12 text-gray-400">
                <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Analytics Tab ─────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {analytics ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["Total Responses", analytics.total_responses],
                  ["Completed", analytics.completed_responses],
                  ["Active Workers", analytics.active_workers],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-[#0A1128]">{v}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{k}</div>
                  </div>
                ))}
              </div>

              {analytics.daily_responses?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Daily Responses</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analytics.daily_responses}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="responses" stroke="#0A1128" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {analytics.worker_performance?.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Worker Performance</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analytics.worker_performance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis dataKey="worker" type="category" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="responses" fill="#0A1128" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {Object.keys(analytics.task_status_counts || {}).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">Task Status Breakdown</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(analytics.task_status_counts).map(([status, count]) => (
                      <div key={status} className={`px-3 py-2 rounded-lg text-center ${TASK_STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}>
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-xs capitalize">{status.replace(/_/g, " ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.daily_responses?.length === 0 && analytics.worker_performance?.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No data yet — analytics will appear once responses come in</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          )}
        </div>
      )}
    </div>
  );
}
