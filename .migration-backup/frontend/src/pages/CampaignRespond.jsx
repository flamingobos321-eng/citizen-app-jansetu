import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { ArrowLeft, Loader2, Search, User, CheckCircle } from "lucide-react";

function DynamicField({ field, value, onChange }) {
  const { type, label, placeholder, help_text, required, options, min_val, max_val } = field;

  const wrap = (children) => (
    <div>
      <Label className="mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {help_text && <p className="text-xs text-gray-400 mt-1">{help_text}</p>}
    </div>
  );

  if (type === "short_text" || type === "mobile" || type === "email" || type === "number") {
    return wrap(
      <Input
        type={type === "number" ? "number" : type === "email" ? "email" : type === "mobile" ? "tel" : "text"}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ""}
      />
    );
  }

  if (type === "long_text" || type === "address") {
    return wrap(
      <Textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""} rows={3} />
    );
  }

  if (type === "date") {
    return wrap(<Input type="date" value={value || ""} onChange={e => onChange(e.target.value)} />);
  }

  if (type === "time") {
    return wrap(<Input type="time" value={value || ""} onChange={e => onChange(e.target.value)} />);
  }

  if (type === "yes_no") {
    return wrap(
      <div className="flex gap-3 mt-1">
        {["Yes", "No"].map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${value === opt ? "bg-[#0A1128] text-white border-[#0A1128]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (type === "single_choice" || type === "dropdown") {
    return wrap(
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue placeholder={placeholder || "Select…"} /></SelectTrigger>
        <SelectContent>
          {(options || []).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    return wrap(
      <div className="space-y-2 mt-1">
        {(options || []).map(o => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} className="rounded" />
            <span className="text-sm text-gray-800">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "rating") {
    const min = min_val || 1;
    const max = max_val || 5;
    const stars = Array.from({ length: max - min + 1 }, (_, i) => i + min);
    return wrap(
      <div className="flex gap-2 mt-1">
        {stars.map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-lg border text-sm font-bold transition-colors ${value === n ? "bg-[#0A1128] text-white border-[#0A1128]" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {n}
          </button>
        ))}
      </div>
    );
  }

  if (type === "gps") {
    const getLocation = () => {
      navigator.geolocation?.getCurrentPosition(
        pos => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => toast.error("Could not get location")
      );
    };
    return wrap(
      <div>
        <Button type="button" variant="outline" size="sm" onClick={getLocation} className="mt-1">
          📍 Capture Location
        </Button>
        {value && (
          <p className="text-xs text-green-600 mt-1">
            Lat: {value.lat?.toFixed(5)}, Lng: {value.lng?.toFixed(5)}
          </p>
        )}
      </div>
    );
  }

  // photo / file — simplified (links to file input)
  if (type === "photo" || type === "file") {
    return wrap(
      <Input type="file" accept={type === "photo" ? "image/*" : undefined}
        onChange={e => onChange(e.target.files?.[0]?.name || "")} className="mt-1" />
    );
  }

  return wrap(<Input value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} />);
}

export default function CampaignRespond() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Citizen linking
  const [citizenSearch, setCitizenSearch] = useState("");
  const [citizenResults, setCitizenResults] = useState([]);
  const [selectedCitizen, setSelectedCitizen] = useState(null);
  const [searching, setSearching] = useState(false);

  // Form values: field_id → value
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    api.get(`/campaigns/${id}`)
      .then(r => setCampaign(r.data))
      .catch(() => { toast.error("Campaign not found"); navigate("/app/campaigns"); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const searchCitizen = async () => {
    if (!citizenSearch.trim()) return;
    setSearching(true);
    try {
      const res = await api.get("/users", { params: { role: "citizen", search: citizenSearch } });
      setCitizenResults(res.data || []);
    } catch { toast.error("Search failed"); } finally { setSearching(false); }
  };

  const setAnswer = (fieldId, value) => setAnswers(prev => ({ ...prev, [fieldId]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fields = campaign?.form_fields || [];
    for (const f of fields) {
      if (f.required && !answers[f.id] && answers[f.id] !== 0) {
        toast.error(`"${f.label}" is required`);
        return;
      }
    }

    const mode = campaign?.response_mode;
    if (mode === "linked_citizen" && !selectedCitizen) {
      toast.error("Please select or register a citizen");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/campaigns/${id}/responses`, {
        citizen_id: selectedCitizen?.id || undefined,
        citizen_name: selectedCitizen?.name || undefined,
        responses: answers,
        status: "completed",
      });
      setSubmitted(true);
      toast.success("Response submitted successfully");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
  );

  if (!campaign) return null;

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center py-20">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[#0A1128] mb-2">Response Submitted!</h2>
        <p className="text-gray-500 text-sm mb-6">Your response has been recorded successfully.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); setAnswers({}); setSelectedCitizen(null); }}>Submit Another</Button>
          <Button className="bg-[#0A1128]" onClick={() => navigate(`/app/campaigns/${id}`)}>Back to Campaign</Button>
        </div>
      </div>
    );
  }

  const mode = campaign.response_mode;
  const fields = campaign.form_fields || [];

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate(`/app/campaigns/${id}`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#0A1128]">{campaign.name}</h1>
          <p className="text-sm text-gray-500">{campaign.campaign_type?.replace(/_/g, " ")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Citizen search (linked_citizen or optional mode) */}
        {(mode === "linked_citizen" || mode === "optional") && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-blue-900 flex items-center gap-1.5">
              <User size={15} />
              {mode === "linked_citizen" ? "Link to Citizen *" : "Link to Citizen (Optional)"}
            </h3>
            {selectedCitizen ? (
              <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-blue-200">
                <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold text-blue-800">
                  {(selectedCitizen.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{selectedCitizen.name}</div>
                  <div className="text-xs text-gray-500">{selectedCitizen.mobile || ""}</div>
                </div>
                <button type="button" onClick={() => setSelectedCitizen(null)} className="text-gray-400 hover:text-red-500">
                  <ArrowLeft size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <Input value={citizenSearch} onChange={e => setCitizenSearch(e.target.value)}
                    placeholder="Search by name or mobile…" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), searchCitizen())} />
                  <Button type="button" variant="outline" onClick={searchCitizen} disabled={searching}>
                    {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  </Button>
                </div>
                {citizenResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                    {citizenResults.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCitizen(c); setCitizenResults([]); }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                          {(c.name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-500">{c.mobile || ""}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {citizenResults.length === 0 && citizenSearch && !searching && (
                  <p className="text-xs text-gray-400 mt-2">No citizens found. Continue without linking or register them first.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic form fields */}
        {fields.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
            <p className="text-sm">This campaign has no form fields yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <h3 className="font-semibold text-gray-900">Form ({fields.length} fields)</h3>
            {fields.map(f => (
              <DynamicField key={f.id} field={f} value={answers[f.id]} onChange={v => setAnswer(f.id, v)} />
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(`/app/campaigns/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1 bg-[#0A1128]" disabled={submitting}>
            {submitting ? <><Loader2 size={15} className="animate-spin mr-2" />Submitting…</> : "Submit Response"}
          </Button>
        </div>
      </form>
    </div>
  );
}
