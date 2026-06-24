import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fileUrl } from "../lib/api";
import { SectionTitle } from "../components/Common";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Upload, MapPin, X } from "lucide-react";

export default function RaiseIssue() {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({
    category: "",
    title: "",
    description: "",
    photos: [],
    gps_lat: null,
    gps_lng: null,
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get("/meta/categories").then((r) => setCats(r.data.issue_categories));
  }, []);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPickPhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await api.post("/files/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        uploaded.push(r.data.path);
      }
      upd("photos", [...form.photos, ...uploaded]);
      toast.success(`Uploaded ${uploaded.length} photo(s)`);
    } catch (err) {
      toast.error("Photo upload unavailable. You can still submit without photos.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (p) => upd("photos", form.photos.filter((x) => x !== p));

  const useGPS = () => {
    if (!navigator.geolocation) {
      toast.error("GPS not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        upd("gps_lat", pos.coords.latitude);
        upd("gps_lng", pos.coords.longitude);
        toast.success("Location captured");
      },
      () => toast.error("Location permission denied")
    );
  };

  const submit = async () => {
    if (!form.category || !form.title || !form.description) {
      toast.error("Category, title and description are required");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/issues", form);
      toast.success(`Issue ${r.data.issue_code} submitted!`);
      navigate(`/app/issues/${r.data.id}`);
    } catch (e) {
      toast.error("Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl animate-fade-up">
      <SectionTitle subtitle="Tell us what's wrong and we'll route it to the right team.">
        Raise an Issue
      </SectionTitle>

      <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 space-y-5">
        <Field label="Category *">
          <Select value={form.category} onValueChange={(v) => upd("category", v)}>
            <SelectTrigger data-testid="issue-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Title *">
          <Input data-testid="issue-title" placeholder="Eg. Large pothole on MG Road" value={form.title} onChange={(e) => upd("title", e.target.value)} />
        </Field>

        <Field label="Description *">
          <Textarea
            data-testid="issue-description"
            rows={5}
            placeholder="Describe the issue, when it started, and how it affects you."
            value={form.description}
            onChange={(e) => upd("description", e.target.value)}
          />
        </Field>

        <Field label="Photos (optional)">
          <div className="flex flex-wrap gap-3">
            {form.photos.map((p) => (
              <div key={p} className="relative w-24 h-24 rounded-md border border-gray-200 overflow-hidden">
                <img src={fileUrl(p)} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(p)} className="absolute top-1 right-1 bg-white rounded-full p-0.5 border border-gray-300" data-testid={`remove-photo-${p}`}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <label className="w-24 h-24 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-xs text-gray-500 cursor-pointer hover:border-[#0A1128]">
              <Upload size={18} />
              <span className="mt-1">{uploading ? "..." : "Add"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPickPhoto} data-testid="photo-input" />
            </label>
          </div>
        </Field>

        <Field label="Location (optional)">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={useGPS} data-testid="gps-btn">
              <MapPin size={14} className="mr-2" /> Use my location
            </Button>
            {form.gps_lat && (
              <span className="text-xs text-gray-500">
                {form.gps_lat.toFixed(4)}, {form.gps_lng.toFixed(4)}
              </span>
            )}
          </div>
        </Field>

        <Button
          data-testid="issue-submit"
          className="w-full bg-[#0A1128] hover:bg-[#0A1128]/90 text-white"
          onClick={submit}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Issue"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{label}</Label>
      {children}
    </div>
  );
}
