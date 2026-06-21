import { useState, useMemo } from "react";
import { PackageCheck, Search, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { useSyncStatuses } from "@/hooks/useShaq";
import { USD_TO_GHS } from "@/lib/mockData";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";

// Ghana regions (for the region filter).
const GHANA_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Western North", "Central", "Eastern",
  "Volta", "Oti", "Bono", "Bono East", "Ahafo", "Northern", "Savannah",
  "North East", "Upper East", "Upper West",
];
const PERIODS = [
  { label: "All time", value: "" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

// FR : Borne calendaire en chaînes YYYY-MM-DD (insensible au fuseau). EN : Calendar bounds as YYYY-MM-DD strings (timezone-safe).
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function presetRange(period) {
  if (!period) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "today") return { from: ymd(today), to: ymd(today) };
  if (period === "yesterday") { const y = new Date(today); y.setDate(today.getDate() - 1); return { from: ymd(y), to: ymd(y) }; }
  if (period === "week") { const s = (now.getDay() + 6) % 7; const m = new Date(today); m.setDate(today.getDate() - s); return { from: ymd(m), to: ymd(today) }; }
  if (period === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(today) };
  return null;
}
function inRange(dateStr, range) {
  if (!range) return true;
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  return d >= range.from && d <= range.to;
}
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

export default function Delivery({ currency = "GHS" }) {
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();
  const syncStatuses = useSyncStatuses();
  const [feedback, setFeedback] = useState("");

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [period, setPeriod] = useState("");

  // Only DELIVERED orders (non-archived).
  const delivered = useMemo(
    () => orders.filter((o) => !o.archived && o.status === "Delivered"),
    [orders]
  );

  const range = useMemo(() => presetRange(period), [period]);
  const filtered = useMemo(() => {
    let d = delivered;
    if (region) d = d.filter((o) => o.region === region);
    if (range) d = d.filter((o) => inRange(o.deliveredAt || o.date, range));
    if (search.trim()) {
      const q = search.toLowerCase();
      const has = (v) => String(v ?? "").toLowerCase().includes(q);
      d = d.filter((o) => has(o.orderNumber) || has(o.customer) || has(o.shaqTrackingId) || has(o.product));
    }
    return d;
  }, [delivered, region, range, search]);

  const money = (usd, ghs) => {
    const g = ghs ?? (usd ?? 0) * USD_TO_GHS;
    return currency === "GHS"
      ? `₵${(g ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `$${(usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

  if (isLoading && !orders.length) return <LoadingState label="Loading deliveries…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load deliveries" />;

  const totalGhs = filtered.reduce((s, o) => s + (o.amountGHS ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PackageCheck size={18} className="text-emerald-600" /> Delivered orders
          </h2>
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-slate-600">{filtered.length.toLocaleString()}</span> delivered
            {currency === "GHS" && <span className="text-emerald-600 font-medium"> · ₵{totalGhs.toLocaleString()}</span>}
          </p>
        </div>
        <button onClick={handleSync} disabled={syncStatuses.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 disabled:opacity-50 w-fit">
          {syncStatuses.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sync statuses
        </button>
      </div>
      {feedback && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{feedback}</p>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, customer, tracking…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <select value={region} onChange={(e) => setRegion(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600">
          <option value="">All regions</option>
          {GHANA_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Order</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Region</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Product</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Tracking</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Delivered at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={PackageCheck} title="No delivered orders" description="Delivered orders will appear here once ShaQ marks them delivered." /></td></tr>
              ) : filtered.map((o) => {
                const realTracking = o.shaqTrackingId && !String(o.shaqTrackingId).startsWith("SHOPIFY-");
                return (
                  <tr key={o.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md whitespace-nowrap">
                        {o.orderNumber || `#${String(o.id).slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-800 leading-tight">{o.customer || "—"}</div>
                      <div className="text-xs text-slate-400 leading-tight">{o.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{o.region || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell max-w-[200px] truncate" title={o.product}>
                      {o.product || "—"}{o.quantity > 1 ? ` ×${o.quantity}` : ""}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-slate-700 whitespace-nowrap">{money(o.amountUSD, o.amountGHS)}</td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {realTracking ? (
                        <a href={`https://tracking.shaqexpress.com/packages/${o.shaqTrackingId}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800">
                          {o.shaqTrackingId} <ExternalLink size={11} />
                        </a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-emerald-600 font-medium">{fmtDate(o.deliveredAt || o.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
