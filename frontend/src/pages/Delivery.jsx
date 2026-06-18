import { useState } from "react";
import { Truck, Search, DownloadCloud, RefreshCw, Loader2 } from "lucide-react";
import { useShaqEvents, useImportPackages, useSyncStatuses } from "@/hooks/useShaq";
import { CANONICAL_STATUSES, colorForStatus } from "@/lib/orderStatus";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";

function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Delivery() {
  const [status, setStatus] = useState("");
  const [tracking, setTracking] = useState("");

  const params = {};
  if (status) params.status = status;
  if (tracking.trim()) params.trackingId = tracking.trim();

  const { data, isLoading, isError, error, refetch } = useShaqEvents(Object.keys(params).length ? params : undefined);
  const events = data?.items ?? [];

  const importPackages = useImportPackages();
  const syncStatuses = useSyncStatuses();
  const [feedback, setFeedback] = useState("");

  const handleImport = async () => {
    setFeedback("");
    try {
      const r = await importPackages.mutateAsync();
      setFeedback(`Import: ${r.created} created, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ""}.`);
    } catch (e) {
      setFeedback(e?.message || "Import failed");
    }
  };

  const handleSync = async () => {
    setFeedback("");
    try {
      const r = await syncStatuses.mutateAsync();
      setFeedback(`Sync: ${r.checked} checked, ${r.changed} updated.`);
      refetch();
    } catch (e) {
      setFeedback(e?.message || "Sync failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Truck size={18} className="text-indigo-600" /> Delivery tracking (ShaQ)</h2>
          <p className="text-sm text-slate-400">{events.length} delivery event(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleImport} disabled={importPackages.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 disabled:opacity-50">
            {importPackages.isPending ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />} Import from ShaQ
          </button>
          <button onClick={handleSync} disabled={syncStatuses.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {syncStatuses.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sync statuses
          </button>
        </div>
      </div>
      {feedback && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{feedback}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={tracking} onChange={(e) => setTracking(e.target.value)}
            placeholder="Search by tracking number…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600">
          <option value="">All statuses</option>
          {CANONICAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading && !data ? (
        <LoadingState label="Loading events…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load events" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Tracking #</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Order</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {events.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No events" /></td></tr>
                ) : events.map((e) => (
                  <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(e.occurredAt)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-indigo-600">{e.trackingId || "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500 hidden md:table-cell">{e.orderId || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorForStatus(e.statusLabel)}`}>
                        {e.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{e.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
