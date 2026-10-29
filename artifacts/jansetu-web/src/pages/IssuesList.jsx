import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { StatusPill, SectionTitle, EmptyState } from "../components/Common";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Search } from "lucide-react";

export default function IssuesList() {
  const { user } = useAuth();
  const isStaff = ["pa", "politician", "admin", "worker"].includes(user?.role);
  const [issues, setIssues] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [meta, setMeta] = useState({ issue_statuses: [], issue_categories: [] });

  useEffect(() => {
    api.get("/meta/categories").then((r) => setMeta(r.data));
  }, []);

  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (status && status !== "ALL") params.status = status;
    if (category && category !== "ALL") params.category = category;
    api.get("/issues", { params }).then((r) => setIssues(r.data));
  }, [search, status, category]);

  return (
    <div className="space-y-6 animate-fade-up">
      <SectionTitle subtitle={isStaff ? "All issues across the constituency" : "Issues you have raised"}>
        {isStaff ? "All Issues" : "My Issues"}
      </SectionTitle>

      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input className="pl-10" placeholder="Search by code, title…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="issue-search" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]" data-testid="filter-status"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {meta.issue_statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]" data-testid="filter-category"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {meta.issue_categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {issues.length === 0 ? (
        <EmptyState title="No issues match" hint="Try changing filters or clearing the search." />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left">
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                {isStaff && <Th>Assigned</Th>}
                <Th>Raised</Th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    <Link to={`/app/issues/${i.id}`} className="font-semibold text-[#0A1128] hover:underline" data-testid={`open-${i.issue_code}`}>
                      {i.issue_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[260px] truncate">{i.title}</td>
                  <td className="px-4 py-3 text-gray-600">{i.category}</td>
                  <td className="px-4 py-3"><StatusPill status={i.status} /></td>
                  {isStaff && <td className="px-4 py-3 text-gray-600">{i.assigned_to_name || <span className="text-gray-400">—</span>}</td>}
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(i.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const Th = ({ children }) => <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-gray-500">{children}</th>;
