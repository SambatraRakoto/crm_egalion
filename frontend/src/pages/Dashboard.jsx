import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  ShoppingCart, TrendingUp, RotateCcw, Package,
  DollarSign, Truck, AlertTriangle, Download, X, CheckCircle2,
} from "lucide-react";
import KpiCard from "../components/crm/KpiCard";
import { useOrders } from "@/hooks/useOrders";
import * as analytics from "@/lib/analytics";
import { config } from "@/config/env";
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
  const [trendView, setTrendView] = useState("month");
  const [period, setPeriod] = useState("all");
  // FR : Filtre par statut de livraison ('all' = tous). EN : Delivery-status filter ('all' = all).
  const [statusFilter, setStatusFilter] = useState("all");
  // FR : Plage personnalisée (YYYY-MM-DD). EN : Custom date range (YYYY-MM-DD).
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Orders are fetched ONCE (shared React Query cache); switching period/status
  // re-aggregates in memory — no re-fetch, so date filters respond instantly.
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();

  const data = useMemo(() => {
    let active = orders.filter((o) => !o.archived);
    if (statusFilter !== "all") active = active.filter((o) => o.status === statusFilter);
    // Period scopes the "snapshot" metrics (KPIs, funnel, distribution, regions,
    // products). Time-series charts keep the full history to show the evolution.
    const scoped = analytics.filterByPeriod(active, period, { from: customFrom, to: customTo });
    return {
      usdToGhs: config.usdToGhs,
      totalOrdersInPeriod: scoped.length,
      kpis: analytics.kpis(scoped),
      ordersByMonth: analytics.ordersByMonth(active),
      ordersByWeek: analytics.ordersByWeek(active),
      ordersByDate: analytics.ordersByDate(active),
      revenueByMonth: analytics.revenueByMonth(active),
      bestSellingProducts: analytics.bestSellingProducts(scoped),
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
    kpis, ordersByMonth: byMonth, ordersByWeek: byWeek, ordersByDate: byDate,
    revenueByMonth: revByMonth, bestSellingProducts: products, deliveryRateByProduct: delRateProd, topRegions: regions,
    regionRevenue: regionRevData, statusDistribution: statusDist, deliveryFunnel: funnel,
    cancellationByRegion: cancByRegion, totalOrdersInPeriod, usdToGhs,
  } = data;

  const periodLabel = period === "custom" && customFrom && customTo
    ? `${customFrom} → ${customTo}`
    : (DATE_FILTERS.find((f) => f.value === period)?.label || "All Time");
  const donutTotal = statusDist.reduce((s, x) => s + x.count, 0) || 1;

  const totalRev = kpis.revenue;
  const totalLogistics = kpis.totalLogistics;
  const commissionShaq = kpis.commissionShaq;
  const avgOrder = kpis.avgOrderValue;
  // Delivered-only perimeter (shown as a sub-line; leads stays primary = Shopify).
  const avgOrderDelivered = kpis.avgOrderValueDelivered || { ghs: 0, usd: 0 };
  const basketDelivered = kpis.basketSizeDelivered ?? 0;

  const trendData = trendView === "month" ? byMonth : trendView === "week" ? byWeek : byDate;

  const orderTrendChartData = {
    labels: trendData.labels,
    datasets: [{ label: "Orders", data: trendData.data, backgroundColor: CHART_COLORS.indigoAlpha, borderColor: CHART_COLORS.indigo, borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: CHART_COLORS.indigo, pointRadius: 3 }],
  };

  const revChartData = {
    labels: revByMonth.labels,
    datasets: [{ label: "Revenue", data: currency === "GHS" ? revByMonth.dataGHS : revByMonth.dataUSD, backgroundColor: CHART_COLORS.emeraldAlpha, borderColor: CHART_COLORS.emerald, borderWidth: 2, fill: true, tension: 0.4, pointBackgroundColor: CHART_COLORS.emerald, pointRadius: 3 }],
  };

  const productsChartData = {
    labels: products.map(([p]) => p.length > 20 ? p.slice(0, 20) + "…" : p),
    datasets: [{ label: "Orders", data: products.map(([, c]) => c), backgroundColor: [CHART_COLORS.indigo, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.rose, CHART_COLORS.violet, CHART_COLORS.sky, "rgba(249,115,22,0.85)", "rgba(20,184,166,0.85)"], borderRadius: 6, borderSkipped: false }],
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
        callbacks: { label: (ctx) => { const r = delRateProd[ctx.dataIndex]; return ` ${r.rate}% (${r.delivered}/${r.total} livrées)`; } },
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
    const rows = regionRevData.map((r) => [r.region, r.orders, r.revenueUSD, (r.revenueUSD * usdToGhs).toFixed(2)].join(","));
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
        <p className="text-sm text-slate-400">Evolving data — orders, deliveries, cancellations, products, regions & performance rates</p>
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

      {/* KPI Grid — 11 cards in one fluid grid (xl: 4/4/3, 2xl: 6/5) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        <KpiCard title="Delivery Rate" value={`${Number(kpis.deliveryRate || 0).toFixed(2)}%`} sub="Delivered / total orders" icon={CheckCircle2} accent="emerald" />
        <KpiCard title="Total Orders" value={totalOrdersInPeriod.toLocaleString()} sub={`${periodLabel}`} icon={ShoppingCart} accent="indigo" trend={0} trendLabel="vs last mo." />
        <KpiCard title="Revenue" value={currency === "GHS" ? `₵${totalRev.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${totalRev.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={currency === "GHS" ? `$${totalRev.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD` : `₵${totalRev.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })} GHS`} icon={TrendingUp} accent="emerald" trend={0} trendLabel="vs last mo." />
        <KpiCard title="Avg. Order Value (all)" value={currency === "GHS" ? `₵${avgOrder.ghs.toLocaleString()}` : `$${avgOrder.usd.toLocaleString()}`} sub={currency === "GHS" ? `Delivered: ₵${avgOrderDelivered.ghs.toLocaleString()}` : `Delivered: $${avgOrderDelivered.usd.toLocaleString()}`} icon={Package} accent="amber" />
        <KpiCard title="Total Logistics" value={currency === "GHS" ? `₵${totalLogistics.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${totalLogistics.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="Delivery costs" icon={Truck} accent="sky" />
        <KpiCard title="ShaQ Commission" value={currency === "GHS" ? `₵${commissionShaq.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${commissionShaq.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="5% of order value" icon={DollarSign} accent="violet" />
        <KpiCard title="Avg. Delivery Time" value={`${kpis.avgDeliveryTime}d`} sub="Days to deliver" icon={Truck} accent="sky" />
        <KpiCard title="Net Margin" value={`${kpis.netMargin}%`} sub="After ShaQ costs" icon={TrendingUp} accent="emerald" trend={0} trendLabel="vs last mo." />
        <KpiCard title="Basket Size (all)" value={`${kpis.basketSize} items`} sub={`Delivered: ${basketDelivered} items`} icon={Package} accent="amber" />
        <KpiCard title="Cancellation Rate" value={`${kpis.cancellationRate}%`} sub="Issues & exceptions" icon={AlertTriangle} accent="rose" />
        <KpiCard title="Return Rate" value={`${kpis.returnRate}%`} sub="Orders returned" icon={RotateCcw} accent="rose" trend={0} trendLabel="vs last mo." />
      </div>

      {/* Delivery Funnel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Delivery Funnel</h2>
        <p className="text-xs text-slate-400 mb-5">Order flow from received to completed</p>
        <div className="space-y-3">
          {funnel.map((step) => (
            <div key={step.label} className="flex items-center gap-4">
              <div className="w-36 text-xs text-slate-600 font-medium text-right flex-shrink-0">{step.label}</div>
              <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden relative">
                <div
                  className={`h-full rounded-lg transition-all ${step.color}`}
                  style={{ width: `${(step.value / funnel[0].value) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center pl-3 text-xs font-semibold text-white mix-blend-overlay">
                  {step.value.toLocaleString()}
                </span>
              </div>
              <div className="w-12 text-xs text-slate-500 font-medium flex-shrink-0">
                {((step.value / funnel[0].value) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Order Trend + Revenue */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Order Trends</h2>
              <p className="text-xs text-slate-400">Volume over time</p>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              {["date", "week", "month"].map((v) => (
                <button key={v} onClick={() => setTrendView(v)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${trendView === v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>
                  {v === "date" ? "Daily" : v === "week" ? "Weekly" : "Monthly"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-52"><Line data={orderTrendChartData} options={baseOpts} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Revenue Performance</h2>
            <p className="text-xs text-slate-400">Monthly revenue — {currency}</p>
          </div>
          <div className="h-52"><Line data={revChartData} options={baseOpts} /></div>
        </div>
      </div>

      {/* Best Selling + Top Regions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Best-Selling Products</h2>
          <p className="text-xs text-slate-400 mb-4">Top 8 by order volume</p>
          <div className="h-56"><Bar data={productsChartData} options={hBarOpts} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">Top Regions by Orders</h2>
          <p className="text-xs text-slate-400 mb-4">Ghanaian regions</p>
          <div className="h-56"><Bar data={regionsChartData} options={hBarOpts} /></div>
        </div>
      </div>

      {/* Delivery Rate by Product */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Delivery Rate by Product</h2>
        <p className="text-xs text-slate-400 mb-4">% of orders delivered, per product (by volume)</p>
        <div className="h-64"><Bar data={deliveryRateChartData} options={deliveryRateOpts} /></div>
      </div>

      {/* Status Donut + Breakdown */}
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

      {/* Region Revenue + Cancellations by Region */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue by Region */}
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
                      {currency === "GHS" ? `₵${(r.revenueUSD * usdToGhs).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${r.revenueUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cancellation by Region */}
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
    </div>
  );
}
