import { useState, useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ShoppingCart, TrendingUp, Package,
  DollarSign, Truck, Download, X, CheckCircle2,
} from "lucide-react";
import KpiCard from "../components/crm/KpiCard";
import { useOrders } from "@/hooks/useOrders";
import * as analytics from "@/lib/analytics";
import { STATUS_CATEGORIES } from "@/lib/orderStatus";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";

const CHART_COLORS = {
  indigo: "rgba(79,70,229,1)",
  indigoAlpha: "rgba(79,70,229,0.15)",
  emerald: "rgba(16,185,129,1)",
  emeraldAlpha: "rgba(16,185,129,0.15)",
  amber: "rgba(245,158,11,1)",
  amberAlpha: "rgba(245,158,11,0.15)",
  rose: "rgba(244,63,94,1)",
  violet: "rgba(139,92,246,1)",
  sky: "rgba(14,165,233,1)",
};

const DONUT_PALETTE = [
  "rgba(79,70,229,0.85)", "rgba(16,185,129,0.85)", "rgba(245,158,11,0.85)",
  "rgba(244,63,94,0.85)", "rgba(139,92,246,0.85)",
];

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1e293b",
      titleColor: "#f1f5f9",
      bodyColor: "#cbd5e1",
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
    y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
  },
};

const hBarOpts = {
  ...baseOpts,
  indexAxis: "y",
  scales: {
    x: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
    y: { grid: { display: false }, ticks: { color: "#475569", font: { size: 11 } } },
  },
};

// UI label → backend period key understood by the dashboard service.
const DATE_FILTERS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
  { label: "All Time", value: "all" },
];

export default function Dashboard({ currency }) {
  const [period, setPeriod] = useState("all");
  // FR : Filtre par statut de livraison ('all' = tous). EN : Delivery-status filter ('all' = all).
  const [statusFilter, setStatusFilter] = useState("all");
  // FR : Plage personnalisée (YYYY-MM-DD). EN : Custom date range (YYYY-MM-DD).
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Orders are fetched ONCE (shared React Query cache); switching period/status
  // re-aggregates in memory — no re-fetch, so date filters respond instantly.
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();

  // EVERY widget below is computed from `scoped` — the same period+status filtered
  // set — so all KPIs, charts and tables share one date filter and stay coherent.
  const data = useMemo(() => {
    let active = orders.filter((o) => !o.archived);
    if (statusFilter !== "all") active = active.filter((o) => o.status === statusFilter);
    const scoped = analytics.filterByPeriod(active, period, { from: customFrom, to: customTo });
    return {
      totalOrdersInPeriod: scoped.length,
      kpis: analytics.kpis(scoped),
      deliveredByProduct: analytics.deliveredByProduct(scoped),
      deliveryRateByProduct: analytics.deliveryRateByProduct(scoped),
      topRegions: analytics.topRegions(scoped),
      regionRevenue: analytics.regionRevenue(scoped),
      statusDistribution: analytics.statusDistribution(scoped),
      deliveryFunnel: analytics.deliveryFunnel(scoped),
      cancellationByRegion: analytics.cancellationByRegion(scoped),
    };
  }, [orders, period, statusFilter, customFrom, customTo]);

  if (isLoading && !orders.length) return <LoadingState label="Loading analytics…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load analytics" />;

  const {
    kpis, deliveredByProduct: deliveredProd, deliveryRateByProduct: delRateProd,
    topRegions: regions, regionRevenue: regionRevData, statusDistribution: statusDist,
    deliveryFunnel: funnel, cancellationByRegion: cancByRegion, totalOrdersInPeriod,
  } = data;

  const periodLabel = period === "custom" && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : (DATE_FILTERS.find((f) => f.value === period)?.label || "All Time");
  const donutTotal = statusDist.reduce((s, x) => s + x.count, 0) || 1;

  const totalRev = kpis.revenue;
  const deliveredRev = kpis.deliveredRevenue || { ghs: 0, usd: 0 };
  const totalLogistics = kpis.totalLogistics;
  const commissionShaq = kpis.commissionShaq;
  // Panier moyen / AOV : la VALEUR LIVRÉE est primaire (logique métier = commandes
  // réellement livrées) ; le panier "toutes commandes" reste en sous-ligne.
  const avgOrder = kpis.avgOrderValue;
  const avgOrderDelivered = kpis.avgOrderValueDelivered || { ghs: 0, usd: 0 };
  const basketDelivered = kpis.basketSizeDelivered ?? 0;

  const money = (v) => (currency === "GHS"
    ? `₵${Number(v.ghs).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `$${Number(v.usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

  // Delivered orders per product (ranking by real fulfilled volume, not all orders).
  const productsChartData = {
    labels: deliveredProd.map(([p]) => (p.length > 20 ? p.slice(0, 20) + "…" : p)),
    datasets: [{ label: "Delivered orders", data: deliveredProd.map(([, c]) => c), backgroundColor: [CHART_COLORS.emerald, CHART_COLORS.indigo, CHART_COLORS.amber, CHART_COLORS.violet, CHART_COLORS.sky, CHART_COLORS.rose, "rgba(249,115,22,0.85)", "rgba(20,184,166,0.85)"], borderRadius: 6, borderSkipped: false }],
  };

  // Delivery rate (%) per product — bars colored by rate (green/amber/rose).
  const deliveryRateChartData = {
    labels: delRateProd.map((r) => (r.product.length > 20 ? r.product.slice(0, 20) + "…" : r.product)),
    datasets: [{
      label: "Delivery rate",
      data: delRateProd.map((r) => r.rate),
      backgroundColor: delRateProd.map((r) => (r.rate >= 80 ? CHART_COLORS.emerald : r.rate >= 50 ? CHART_COLORS.amber : CHART_COLORS.rose)),
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const deliveryRateOpts = {
    ...hBarOpts,
    scales: {
      x: { min: 0, max: 100, grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 }, callback: (v) => `${v}%` } },
      y: { grid: { display: false }, ticks: { color: "#475569", font: { size: 11 } } },
    },
    plugins: {
      ...hBarOpts.plugins,
      tooltip: {
        ...hBarOpts.plugins.tooltip,
        callbacks: { label: (ctx) => { const r = delRateProd[ctx.dataIndex]; return ` ${r.rate}% (${r.delivered}/${r.total} delivered)`; } },
      },
    },
  };

  const regionsChartData = {
    labels: regions.map(([r]) => r),
    datasets: [{ label: "Orders", data: regions.map(([, c]) => c), backgroundColor: CHART_COLORS.indigoAlpha, borderColor: CHART_COLORS.indigo, borderWidth: 2, borderRadius: 6 }],
  };

  const donutData = {
    labels: statusDist.map((s) => s.label),
    datasets: [{ data: statusDist.map((s) => s.count), backgroundColor: DONUT_PALETTE, borderWidth: 2, borderColor: "#fff" }],
  };

  const donutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom", labels: { color: "#64748b", font: { size: 11 }, padding: 12, boxWidth: 12 } },
      tooltip: {
        backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8,
        callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / donutTotal) * 100).toFixed(1)}%)` },
      },
    },
    cutout: "65%",
  };

  const exportCSV = () => {
    const headers = ["Region", "Orders", "Revenue (USD)", "Revenue (GHS)"];
    const rows = regionRevData.map((r) => [r.region, r.orders, r.revenueUSD, r.revenueGHS].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dashboard-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Operational dashboard</h2>
        <p className="text-sm text-slate-400">Orders, deliveries, products, regions & performance — coherent with Shopify and delivered orders</p>
      </div>

      {/* Period Filter + Status Filter + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
            {DATE_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setPeriod(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${period === f.value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Custom date range — selecting both dates activates the "custom" period */}
          <div className={`flex items-center gap-1.5 bg-white border rounded-xl px-2.5 py-1.5 ${period === "custom" ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}
            title="Custom date range">
            <input type="date" value={customFrom}
              onChange={(e) => { setCustomFrom(e.target.value); if (e.target.value && customTo) setPeriod("custom"); }}
              className="text-xs text-slate-600 bg-transparent outline-none w-[7.5rem]" />
            <span className="text-slate-300 text-xs">→</span>
            <input type="date" value={customTo} min={customFrom || undefined}
              onChange={(e) => { setCustomTo(e.target.value); if (customFrom && e.target.value) setPeriod("custom"); }}
              className="text-xs text-slate-600 bg-transparent outline-none w-[7.5rem]" />
            {period === "custom" && (
              <button onClick={() => { setPeriod("all"); setCustomFrom(""); setCustomTo(""); }}
                className="ml-0.5 text-slate-400 hover:text-rose-500" title="Clear custom range">
                <X size={13} />
              </button>
            )}
          </div>
          {/* Delivery-status filter (grouped by ShaQ category) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-xs font-medium bg-white border outline-none focus:ring-2 focus:ring-indigo-200 ${statusFilter !== "all" ? "border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-600"}`}
            title="Filter by delivery status"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_CATEGORIES).map(([category, labels]) => (
              <optgroup key={category} label={category}>
                {labels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors w-fit">
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* ─── KPIs ──────────────────────────────────────────────────────────────
          Grouped left→right: volume & delivery · revenue · costs & margin.
          Every value below is scoped to {periodLabel}. */}
      {/* Volume & delivery */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Total Orders" value={totalOrdersInPeriod.toLocaleString()} sub={periodLabel} icon={ShoppingCart} accent="indigo" />
        <KpiCard title="Delivery Rate" value={`${kpis.deliveryRate}%`} sub="Delivered / total orders" icon={CheckCircle2} accent="emerald" />
        <KpiCard title="Avg. Delivery Time" value={`${kpis.avgDeliveryTime}d`} sub="Days, ordered → delivered" icon={Truck} accent="sky" />
        <KpiCard title="Revenue" value={money(totalRev)} sub={`Shopify total · ${currency === "GHS" ? `$${totalRev.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `₵${totalRev.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}`} icon={TrendingUp} accent="emerald" />
        <KpiCard title="Delivered Revenue" value={money(deliveredRev)} sub="Collected on delivered orders" icon={TrendingUp} accent="emerald" />
      </div>

      {/* Revenue economics & basket */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard title="Avg. Order Value" value={money(avgOrderDelivered)} sub={`Delivered · all orders: ${money(avgOrder)}`} icon={Package} accent="amber" />
        <KpiCard title="Basket Size" value={`${basketDelivered} items`} sub={`Delivered · all orders: ${kpis.basketSize} items`} icon={Package} accent="amber" />
        <KpiCard title="Total Logistics" value={money(totalLogistics)} sub="Delivery cost · delivered" icon={Truck} accent="sky" />
        <KpiCard title="ShaQ Handling Fee" value={money(commissionShaq)} sub="5% of (revenue − delivery), delivered" icon={DollarSign} accent="violet" />
        <KpiCard title="Net Margin" value={`${kpis.netMargin}%`} sub="(revenue − delivery) − 5%, delivered" icon={TrendingUp} accent="emerald" />
      </div>

      {/* ─── Delivery Funnel ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Delivery Funnel</h2>
        <p className="text-xs text-slate-400 mb-5">Received ⊇ Collected ⊇ In Transit ⊇ Delivered — returned shown separately</p>
        <div className="space-y-3">
          {funnel.map((step) => (
            <div key={step.label} className="flex items-center gap-4">
              <div className="w-36 text-xs text-slate-600 font-medium text-right flex-shrink-0">{step.label}</div>
              <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all ${step.color}`}
                  style={{ width: `${funnel[0].value ? (step.value / funnel[0].value) * 100 : 0}%` }}
                />
                <span className="absolute inset-0 flex items-center pl-3 text-xs font-semibold text-white mix-blend-overlay">
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div className="w-12 text-xs text-slate-500 font-medium flex-shrink-0">
                {funnel[0].value ? ((step.value / funnel[0].value) * 100).toFixed(0) : 0}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Status overview ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Order Status Distribution</h2>
          <p className="text-xs text-slate-400 mb-4">Breakdown by category</p>
          <div className="h-64"><Doughnut data={donutData} options={donutOpts} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Category Breakdown</h2>
          <p className="text-xs text-slate-400 mb-4">Percentage of total orders</p>
          <div className="space-y-3 mt-2">
            {statusDist.map((s, i) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{s.label}</span>
                  <span className="text-slate-500">{s.count} <span className="text-indigo-600 font-semibold">({s.pct}%)</span></span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: DONUT_PALETTE[i % DONUT_PALETTE.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Product performance ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Delivered Orders by Product</h2>
          <p className="text-xs text-slate-400 mb-4">Top 8 by delivered orders</p>
          <div className="h-56"><Bar data={productsChartData} options={hBarOpts} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Delivery Rate by Product</h2>
          <p className="text-xs text-slate-400 mb-4">% of orders delivered, per product (by volume)</p>
          <div className="h-64"><Bar data={deliveryRateChartData} options={deliveryRateOpts} /></div>
        </div>
      </div>

      {/* ─── Regions ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Top Regions by Orders</h2>
          <p className="text-xs text-slate-400 mb-4">Ghanaian regions</p>
          <div className="h-56"><Bar data={regionsChartData} options={hBarOpts} /></div>
        </div>

        {/* Revenue by Region (native GHS — Shopify parity) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-slate-800">Revenue by Region</h2>
            <p className="text-xs text-slate-400">Top regions by revenue</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Region</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Orders</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {regionRevData.map((r, i) => (
                  <tr key={r.region} className={`hover:bg-indigo-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-2.5 text-slate-700 text-xs font-medium">{r.region}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{r.orders}</td>
                    <td className="px-4 py-2.5 text-right text-slate-800 text-xs font-semibold">
                      {currency === "GHS" ? `₵${r.revenueGHS.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${r.revenueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Cancellation by Region ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-slate-800">Cancellation Analysis by Region</h2>
          <p className="text-xs text-slate-400">Issues & exceptions rate per region</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Region</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Rate</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">Issues</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cancByRegion.map((r, i) => (
                <tr key={r.region} className={`hover:bg-rose-50/30 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                  <td className="px-4 py-2.5 text-slate-700 text-xs font-medium">{r.region}</td>
                  <td className="px-4 py-2.5 text-right text-xs">
                    <span className={`font-semibold ${r.rate > 20 ? "text-rose-600" : r.rate > 15 ? "text-amber-600" : "text-emerald-600"}`}>{r.rate}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{r.cancelled}/{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
