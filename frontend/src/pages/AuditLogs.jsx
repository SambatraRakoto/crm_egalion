import { useState } from "react";
import { Shield, Filter } from "lucide-react";
import { useAuditLogs } from "@/hooks/useAudit";
import { AUDIT_ACTIONS } from "@/services/audit.service";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";

const ACTION_BADGE = (action) => {
  if (action.endsWith(".delete")) return "bg-rose-100 text-rose-700";
  if (action.endsWith(".create")) return "bg-emerald-100 text-emerald-700";
  if (action.endsWith(".update") || action.endsWith(".archive") || action.endsWith(".restore")) return "bg-amber-100 text-amber-700";
  if (action.startsWith("user.login") || action.startsWith("user.logout")) return "bg-slate-100 text-slate-600";
  return "bg-indigo-100 text-indigo-700";
};

function fmtDateTime(v) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditLogs() {
  const [action, setAction] = useState("");
  const { data, isLoading, isError, error, refetch } = useAuditLogs(action ? { action } : undefined);
  const logs = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Shield size={18} className="text-indigo-600" /> Audit log</h2>
          <p className="text-sm text-slate-400">Traceability of sensitive actions</p>
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600">
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {isLoading && !data ? (
        <LoadingState label="Loading audit log…" />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} title="Could not load audit log" />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Action</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Entity</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState title="No entries" /></td></tr>
                ) : logs.map((l) => (
                  <tr key={l.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-medium">{l.userName || l.userId || "System"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ACTION_BADGE(l.action)}`}>{l.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">
                      {l.entityType ? <span className="font-mono">{l.entityType}{l.entityId ? `:${String(l.entityId).slice(0, 8)}` : ""}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell font-mono">{l.ip || "—"}</td>
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
