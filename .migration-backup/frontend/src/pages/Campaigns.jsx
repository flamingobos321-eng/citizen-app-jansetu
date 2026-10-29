import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../components/ui/sheet";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Plus, Search, Megaphone, Users, BarChart2, Clock, CheckCircle,
  Archive, ChevronRight, Calendar, Loader2,
} from "lucide-react";

const CAMPAIGN_TYPE_LABELS = {
  membership_drive: "Membership Drive",
  opinion_survey: "Opinion Survey",
  citizen_data: "Citizen Data",
  scheme_registration: "Scheme Registration",
  voter_registration: "Voter Registration",
  development_inspection: "Development Inspection",
  complaint_followup: "Complaint Follow-up",
  health_camp: "Health Camp",
  blood_donation: "Blood Donation",
  tree_plantation: "Tree Plantation",
  scholarship_drive: "Scholarship Drive",
  booth_strengthening: "Booth Strengthening",
  election_campaign: "Election Campaign",
  voter_awareness: "Voter Awareness",
  event_registration: "Event Registration",
  volunteer_registration: "Volunteer Registration",
  custom: "Custom",
};

const STATUS_CONFIG = {
  draft:     { label: "Draft",     color: "bg-gray-100 text-gray-700" },
  active:    { label: "Active",    color: "bg-green-100 text-green-700" },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700" },
  archived:  { label: "Archived",  color: "bg-red-100 text-red-700" },
};

const PRIORITY_CONFIG = {
  low:    { label: "Low",    color: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  high:   { label: "High",   color: "bg-orange-100 text-orange-700" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700" },
};

const CAMPAIGN_TYPES = Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function StatCard({ icon: Icon, label, value, color = "text-[#0A1128]" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-gray-600" />
      </div>
      <div>
        <div className={`text-2xl font-bold font-heading ${color}`}>{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, onClick }) {
  const sc = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const pc = PRIORITY_CONFIG[campaign.priority] || PRIORITY_CONFIG.medium;
  const typeLabel = CAMPAIGN_TYPE_LABELS[campaign.campaign_type] || campaign.campaign_type;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-[#0A1128] hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{typeLabel}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pc.color}`}>{pc.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
        </div>
      </div>
      {campaign.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">{campaign.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <BarChart2 size={12} />
          {campaign.total_responses ?? 0} responses
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} />
          {(campaign.assigned_worker_ids || []).length} workers
        </span>
        {campaign.end_date && (
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {campaign.end_date}
          </span>
        )}
        <ChevronRight size={14} className="ml-auto" />
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "", campaign_type: "custom", description: "", objectives: "",
  priority: "medium", response_mode: "linked_citizen",
  start_date: "", end_date: "",
};

export default function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = ["admin", "super_admin", "pa", "politician"].includes(user?.role);

  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterType !== "all") params.campaign_type = filterType;
      if (filterPriority !== "all") params.priority = filterPriority;
      if (search) params.search = search;
      const [statsRes, listRes] = await Promise.all([
        api.get("/campaigns/stats"),
        api.get("/campaigns", { params }),
      ]);
      setStats(statsRes.data);
      setCampaigns(listRes.data);
    } catch (e) {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, filterPriority, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Campaign name is required");
    setSaving(true);
    try {
      const res = await api.post("/campaigns", {
        ...form,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      });
      toast.success("Campaign created");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      navigate(`/app/campaigns/${res.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[#0A1128]">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Field operations, surveys, and data collection</p>
        </div>
        {isStaff && (
          <Sheet open={createOpen} onOpenChange={setCreateOpen}>
            <SheetTrigger asChild>
              <Button className="bg-[#0A1128] hover:bg-[#0A1128]/90 gap-2">
                <Plus size={16} /> New Campaign
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Create Campaign</SheetTitle>
              </SheetHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-6">
                <div>
                  <Label>Campaign Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ward 5 Membership Drive 2025" className="mt-1" />
                </div>
                <div>
                  <Label>Campaign Type</Label>
                  <Select value={form.campaign_type} onValueChange={v => setForm(f => ({ ...f, campaign_type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPAIGN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
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
                    <Label>Response Mode</Label>
                    <Select value={form.response_mode} onValueChange={v => setForm(f => ({ ...f, response_mode: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linked_citizen">Linked to Citizen</SelectItem>
                        <SelectItem value="anonymous">Anonymous</SelectItem>
                        <SelectItem value="optional">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start Date</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What is this campaign about?" rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Objectives</Label>
                  <Textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                    placeholder="Key goals and expected outcomes" rows={2} className="mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-[#0A1128]" disabled={saving}>
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                    Create & Configure
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard icon={Megaphone} label="Total" value={stats.total} />
          <StatCard icon={CheckCircle} label="Active" value={stats.active} color="text-green-700" />
          <StatCard icon={Clock} label="Draft" value={stats.draft} color="text-gray-500" />
          <StatCard icon={CheckCircle} label="Completed" value={stats.completed} color="text-blue-700" />
          <StatCard icon={Archive} label="Archived" value={stats.archived} color="text-red-600" />
          <StatCard icon={BarChart2} label="Responses" value={stats.total_responses} color="text-purple-700" />
          <StatCard icon={Users} label="Workers" value={stats.active_workers} color="text-orange-700" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…" className="pl-9" />
        </div>
        {isStaff && (
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CAMPAIGN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {isStaff && (
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No campaigns found</p>
          {isStaff && <p className="text-sm mt-1">Create your first campaign to get started</p>}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} onClick={() => navigate(`/app/campaigns/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
