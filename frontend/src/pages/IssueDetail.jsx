import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusPill, SectionTitle } from "../components/Common";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Star } from "lucide-react";

const FLOW = ["New", "Under Review", "Assigned", "In Progress", "Resolved", "Verified"];

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [assignTo, setAssignTo] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const load = () => api.get(`/issues/${id}`).then((r) => setData(r.data));

  useEffect(() => {
    load();
    api.get("/users", { params: { role: "worker" } }).then((r) => setWorkers(r.data)).catch(() => {});
  }, [id]);

  if (!data) return <div className="p-8 text-sm text-gray-500">Loading…</div>;

  const issue = data.issue;
  const isCitizen = user?.role === "citizen";
  const isAdmin = user?.role === "admin";
  const isPA = user?.role === "pa";
  const isMLA = user?.role === "politician";
  const canAssign = isPA || isAdmin; // MLA cannot assign
  const isAssignee = user?.role === "worker" && issue.assigned_to === user.id;
  const canUpdateStatus = canAssign || isAssignee;
  const canVerify = isCitizen && issue.status === "Resolved";

  const assign = async () => {
    if (!assignTo) return toast.error("Select a worker");
    try {
      await api.post(`/issues/${id}/assign`, { assigned_to: assignTo, remarks: note });
      toast.success("Issue assigned");
      setNote("");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const updateStatus = async () => {
    if (!statusUpdate) return toast.error("Select a status");
    try {
      await api.post(`/issues/${id}/status`, { status: statusUpdate, remarks: note });
      toast.success("Status updated");
      setStatusUpdate("");
      setNote("");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const sendFeedback = async (verified) => {
    if (rating === 0) return toast.error("Please rate first");
    try {
      await api.post(`/issues/${id}/feedback`, { rating, comment, verified });
      toast.success(verified ? "Thanks for confirming!" : "Reopened — we'll look again");
      setComment("");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div className="max-w-5xl animate-fade-up">
      <Link to={isStaff || user?.role === "worker" ? "/app/issues" : "/app/my-issues"} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4" data-testid="back-issues">
        <ArrowLeft size={16} /> Back to issues
      </Link>

      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div>
          <div className="text-xs font-mono text-gray-500">{issue.issue_code}</div>
          <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight mt-1">{issue.title}</h1>
          <div className="text-sm text-gray-500 mt-1">{issue.category} · {new Date(issue.created_at).toLocaleString()}</div>
        </div>
        <StatusPill status={issue.status} testId="issue-status" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="font-heading font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
          </Card>

          {issue.photos?.length > 0 && (
            <Card>
              <h3 className="font-heading font-semibold text-gray-900 mb-3">Photos</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {issue.photos.map((p) => (
                  <a key={p} href={`${process.env.REACT_APP_BACKEND_URL}/api/files/${p}`} target="_blank" rel="noreferrer">
                    <img src={`${process.env.REACT_APP_BACKEND_URL}/api/files/${p}`} alt="" className="w-full h-24 object-cover rounded-md border border-gray-200" />
                  </a>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-heading font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-4">
              {FLOW.map((s, idx) => {
                const event = issue.timeline?.find((t) => t.status === s);
                const reached = FLOW.indexOf(issue.status) >= idx || event;
                return (
                  <div key={s} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${reached ? "bg-[#10B981]" : "bg-gray-300"}`} />
                      {idx < FLOW.length - 1 && <div className={`w-0.5 flex-1 ${reached ? "bg-[#10B981]" : "bg-gray-200"}`} />}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="font-semibold text-sm text-gray-900">{s}</div>
                      {event && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(event.at).toLocaleString()} · by {event.by}
                          {event.note && <div className="mt-0.5 text-gray-600">{event.note}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {canVerify && (
            <Card>
              <h3 className="font-heading font-semibold text-gray-900">Was this resolved?</h3>
              <p className="text-sm text-gray-500 mt-1">Your feedback helps us improve.</p>
              <div className="flex gap-2 mt-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} data-testid={`rate-${n}`}>
                    <Star size={28} className={n <= rating ? "fill-[#F59E0B] text-[#F59E0B]" : "text-gray-300"} />
                  </button>
                ))}
              </div>
              <Textarea className="mt-3" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} data-testid="feedback-comment" />
              <div className="flex gap-3 mt-3">
                <Button onClick={() => sendFeedback(true)} className="bg-[#10B981] hover:bg-[#10B981]/90 text-white" data-testid="confirm-resolved">Confirm resolved</Button>
                <Button onClick={() => sendFeedback(false)} variant="outline" data-testid="reopen-issue">Not resolved — reopen</Button>
              </div>
            </Card>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-heading font-semibold text-gray-900 mb-3">Citizen</h3>
            <Row label="Name" value={data.citizen?.name} />
            <Row label="Mobile" value={data.citizen?.mobile} />
            <Row label="Address" value={data.citizen?.address} />
          </Card>

          <Card>
            <h3 className="font-heading font-semibold text-gray-900 mb-3">Assignment</h3>
            {issue.assigned_to_name ? (
              <Row label="Assigned to" value={issue.assigned_to_name} />
            ) : (
              <div className="text-sm text-gray-500">Not assigned yet</div>
            )}
            {issue.remarks && <Row label="Remarks" value={issue.remarks} />}
          </Card>

          {isMLA && (
            <Card>
              <h3 className="font-heading font-semibold text-gray-900 mb-2">MLA view (read-only)</h3>
              <p className="text-xs text-gray-500">As the elected representative, you have monitoring access. Assignment and status updates are handled by your PA/office.</p>
            </Card>
          )}

          {canAssign && (
            <Card>
              <h3 className="font-heading font-semibold text-gray-900 mb-3">Staff actions</h3>
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-gray-500">Assign to worker</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger className="mt-2" data-testid="assign-select"><SelectValue placeholder="Choose worker" /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · {w.designation}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Remarks (optional)" className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} data-testid="staff-note" />
              <Button className="w-full mt-3 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={assign} data-testid="assign-btn">Assign</Button>
            </Card>
          )}

          {canUpdateStatus && (
            <Card>
              <h3 className="font-heading font-semibold text-gray-900 mb-3">Update status</h3>
              <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                <SelectTrigger data-testid="status-update-select"><SelectValue placeholder="Change to…" /></SelectTrigger>
                <SelectContent>
                  {["Under Review", "In Progress", "Resolved"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea placeholder="Notes / progress (optional)" className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} data-testid="status-note" />
              <Button className="w-full mt-3 bg-[#0A1128] hover:bg-[#0A1128]/90 text-white" onClick={updateStatus} data-testid="update-status-btn">Update</Button>
              {isAssignee && (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  data-testid="request-reassign-btn"
                  onClick={async () => {
                    const reason = window.prompt("Reason for reassignment?") || "";
                    try {
                      await api.post(`/issues/${id}/request-reassign`, null, { params: { reason } });
                      toast.success("Reassignment requested");
                      load();
                    } catch {
                      toast.error("Failed");
                    }
                  }}
                >
                  Request reassignment
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const Card = ({ children }) => <div className="bg-white border border-gray-200 rounded-lg p-5">{children}</div>;
const Row = ({ label, value }) => (
  <div className="grid grid-cols-3 py-1.5 text-sm">
    <div className="text-gray-500 text-xs uppercase tracking-wider font-bold">{label}</div>
    <div className="col-span-2 text-gray-900">{value || "—"}</div>
  </div>
);
