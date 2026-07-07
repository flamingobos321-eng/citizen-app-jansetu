import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, AlertCircle, RefreshCw, Download,
  Loader2, ClipboardList, FileSpreadsheet, XCircle,
} from "lucide-react";

// Electoral Roll Import — Admin module.
// Business rules (per PRD, do NOT change):
//   • Every voter card becomes ONE independent Person.
//   • Family relationships are NEVER inferred from the roll.
//   • Duplicate detection is keyed on (Office, EPIC).
//   • Languages supported: English + Marathi (auto-detected).
export default function AdminElectoralRoll() {
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState({});     // { fileName: 0-100 }
  const [lastSummary, setLastSummary] = useState(null);
  const [detailOpen, setDetailOpen] = useState(null); // import row when errors expanded

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/admin/electoral-roll/imports");
      setImports(r.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load import history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const bad = files.filter((f) => !/\.pdf$/i.test(f.name));
    if (bad.length) {
      toast.error("Only PDF files are supported");
      return;
    }
    setUploading(true);
    setLastSummary(null);
    const init = {};
    files.forEach((f) => { init[f.name] = 0; });
    setProgress(init);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const r = await api.post("/admin/electoral-roll/upload", form, {
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded * 100) / e.total) : 0;
          setProgress((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((k) => { next[k] = pct; });
            return next;
          });
        },
      });
      toast.success(`Uploaded ${files.length} file(s) — processing in background. This can take a few minutes for scanned PDFs.`);
      setLastSummary(r.data);
      await load();
      // Poll every 4s for up to 15 minutes to refresh the history table.
      const start = Date.now();
      const poll = async () => {
        if (Date.now() - start > 15 * 60 * 1000) return;
        try {
          const r2 = await api.get("/admin/electoral-roll/imports");
          setImports(r2.data || []);
          const stillProcessing = (r2.data || []).some((row) => row.status === "processing");
          if (stillProcessing) setTimeout(poll, 4000);
        } catch (_) { /* ignore */ }
      };
      setTimeout(poll, 3000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      setProgress({});
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const openDetail = async (id) => {
    try {
      const r = await api.get(`/admin/electoral-roll/imports/${id}`);
      setDetailOpen(r.data);
    } catch (e) {
      toast.error("Failed to load import details");
    }
  };

  const downloadErrors = (id) => {
    const token = localStorage.getItem("jansetu_token");
    const url = `${api.defaults.baseURL}/admin/electoral-roll/imports/${id}/errors.csv`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `electoral_errors_${id}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="admin-electoral-roll">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900 tracking-tight">Electoral Roll Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload Election Commission electoral roll PDFs (English or Marathi). Language is auto-detected.
            Every voter becomes an independent Person — family links are never inferred.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} data-testid="er-refresh">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </header>

      {/* Uploader */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? "border-[#0A1128] bg-[#0A1128]/5" : "border-gray-300 bg-white"
        }`}
        data-testid="er-dropzone"
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <div className="font-heading font-semibold text-gray-900">Drag & drop PDF files here</div>
        <div className="text-xs text-gray-500 mt-1">or click below to browse. Multiple files supported.</div>
        <label className="inline-block mt-4">
          <input
            type="file"
            multiple
            accept="application/pdf"
            className="hidden"
            data-testid="er-file-input"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0A1128] hover:bg-[#0A1128]/90 text-white text-sm cursor-pointer">
            <FileText className="w-4 h-4" />
            {uploading ? "Uploading…" : "Choose PDFs"}
          </span>
        </label>

        {uploading && Object.keys(progress).length > 0 && (
          <div className="mt-6 space-y-2 max-w-md mx-auto text-left">
            {Object.entries(progress).map(([name, pct]) => (
              <div key={name}>
                <div className="flex justify-between text-xs text-gray-600 mb-0.5">
                  <span className="truncate mr-2">{name}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
                  <div className="h-full bg-[#0A1128] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Last upload — queued files (async background processing) */}
      {lastSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-4" data-testid="er-last-summary">
          <div className="font-heading font-semibold text-gray-900 mb-2">Files queued for processing</div>
          <p className="text-xs text-gray-500 mb-2">
            Processing runs in the background — scanned PDFs are OCR&apos;d page-by-page and can take several minutes.
            The Import history table below refreshes automatically.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {(lastSummary.queued || []).map((s) => (
              <div key={s.id || s.file_name} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  {s.status === "processing"
                    ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    : s.status === "completed"
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <XCircle className="w-4 h-4 text-red-600" />}
                  <span className="truncate">{s.file_name}</span>
                </div>
                <div className="text-[11px] text-gray-500 mt-1 uppercase tracking-widest">
                  {s.status}{s.error ? ` · ${s.error}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import history */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-gray-600" />
          <h2 className="font-heading font-semibold text-gray-900">Import history</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] uppercase tracking-widest text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Uploaded by</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Part</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Imported</th>
                  <th className="px-4 py-3 text-right">Updated</th>
                  <th className="px-4 py-3 text-right">Failed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {imports.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} className="px-4 py-6 text-center text-sm text-gray-500" data-testid="er-empty">
                      No imports yet. Upload your first Electoral Roll PDF above.
                    </td>
                  </tr>
                )}
                {imports.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50" data-testid={`er-row-${r.id}`}>
                    <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 max-w-[220px] truncate" title={r.file_name}>{r.file_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.uploaded_by_name || "—"}</td>
                    <td className="px-4 py-3 text-xs uppercase">{r.language || "—"}</td>
                    <td className="px-4 py-3 text-xs">{r.part_number || "—"}</td>
                    <td className="px-4 py-3 text-right">{r.total_records}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-semibold">{r.imported}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{r.updated}</td>
                    <td className="px-4 py-3 text-right text-red-700">{r.failed}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openDetail(r.id)} data-testid={`er-detail-${r.id}`}>
                          Details
                        </Button>
                        {r.failed > 0 && (
                          <Button variant="outline" size="sm" onClick={() => downloadErrors(r.id)} data-testid={`er-errors-${r.id}`}>
                            <Download className="w-3.5 h-3.5 mr-1" /> Errors CSV
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Detail drawer */}
      {detailOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setDetailOpen(null)}>
          <div className="w-full max-w-lg bg-white h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()} data-testid="er-detail-drawer">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-gray-900">Import Details</h3>
              <button onClick={() => setDetailOpen(null)} className="text-gray-500 hover:text-gray-900" data-testid="er-close-drawer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <dl className="text-sm space-y-2">
              <Row label="File">{detailOpen.file_name}</Row>
              <Row label="Language">{detailOpen.language}</Row>
              <Row label="State / District / Taluka">
                {[detailOpen.state, detailOpen.district, detailOpen.taluka].filter(Boolean).join(" · ") || "—"}
              </Row>
              <Row label="Village / City">{detailOpen.village_label || "—"}</Row>
              <Row label="Assembly Constituency">{detailOpen.assembly_constituency || "—"}</Row>
              <Row label="Parliamentary Constituency">{detailOpen.parliamentary_constituency || "—"}</Row>
              <Row label="Part / Booth">{[detailOpen.part_number, detailOpen.booth_number].filter(Boolean).join(" / ") || "—"}</Row>
              <Row label="Uploaded by">{detailOpen.uploaded_by_name || "—"}</Row>
              <Row label="Processing time">{detailOpen.processing_ms} ms</Row>
              <Row label="Total records">{detailOpen.total_records}</Row>
              <Row label="Imported">{detailOpen.imported}</Row>
              <Row label="Updated">{detailOpen.updated}</Row>
              <Row label="Duplicates">{detailOpen.duplicates}</Row>
              <Row label="Failed">{detailOpen.failed}</Row>
            </dl>
            {(detailOpen.errors || []).length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="font-heading font-semibold text-gray-900">Errors</span>
                  <Button variant="outline" size="sm" onClick={() => downloadErrors(detailOpen.id)} data-testid="er-detail-errors-csv">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Download CSV
                  </Button>
                </div>
                <ul className="text-xs text-gray-600 space-y-1 max-h-64 overflow-y-auto">
                  {detailOpen.errors.slice(0, 200).map((e, idx) => (
                    <li key={idx} className="border-l-2 border-red-200 pl-2">
                      Page {e.page ?? "—"} · Record {e.record_number ?? "—"} — {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function Stat({ label, value, tone = "gray" }) {
  const toneCls = {
    gray: "text-gray-700",
    green: "text-green-700",
    blue: "text-blue-700",
    red: "text-red-700",
  }[tone];
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`font-semibold ${toneCls}`}>{value ?? 0}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = status === "completed" ? "bg-green-50 text-green-700 border-green-200"
            : status === "processing" ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-red-50 text-red-700 border-red-200";
  return <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 border rounded ${cls}`}>{status}</span>;
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <dt className="text-xs uppercase tracking-widest text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{children}</dd>
    </div>
  );
}
