import { useState } from "react";
import { Bar, Line } from "react-chartjs-2";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Download, FileText, Wallet, CreditCard, Clock,
} from "lucide-react";
import KpiCard from "../components/crm/KpiCard";
import { useFinance } from "@/hooks/useFinance";
import { exportFinancePdf } from "@/lib/financePdf";
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
  roseAlpha: "rgba(244,63,94,0.12)",
};

const lineOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
    y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
  },
};

// Period presets understood by the backend (/finance/summary?period=…).
const PERIODS = [
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
  { label: "This year", value: "year" },
  { label: "All time", value: "all" },
];

export default function Financials({ currency }) {
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const effectivePeriod = showCustom && (customFrom || customTo) ? "custom" : period;
  const { data, isLoading, isError, error, refetch } = useFinance({
    period: effectivePeriod,
    from: effectivePeriod === "custom" ? customFrom || undefined : undefined,
    to: effectivePeriod === "custom" ? customTo || undefined : undefined,
  });

  // byMonth is already scoped to the selected period by the service.
  const monthlyData = data?.byMonth ?? [];

  const sym = currency === "GHS" ? "₵" : "$";
  const revKey = currency === "GHS" ? "revenueGHS" : "revenueUSD";
  const collectedKey = currency === "GHS" ? "collectedGHS" : "collectedUSD";
  const outKey = currency === "GHS" ? "outstandingGHS" : "outstandingUSD";
  const logKey = currency === "GHS" ? "logisticsGHS" : "logisticsUSD";

  const last = monthlyData[monthlyData.length - 1];
  const prev = monthlyData[monthlyData.length - 2];
  const revChange = prev ? (((last?.[revKey] - prev[revKey]) / prev[revKey]) * 100).toFixed(1) : null;

  const periodLabel = effectivePeriod === "custom"
    ? "Custom range"
    : PERIODS.find((p) => p.value === period)?.label || "All time";

  if (isLoading && !data) return <LoadingState label="Loading financial data…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load financials" />;
  if (!data) return null;

  const { collected, outstanding, cod, returnRate, deliveryRate, deliveredOrders, usdToGhs } = data;
  // Period-exact settled amounts (the "données figées" of the finance dashboard).
  const pick = (m) => (currency === "GHS" ? m?.ghs ?? 0 : m?.usd ?? 0);
  const periodRevenue = pick(collected) + pick(outstanding);
  const periodCollected = pick(collected); // ce qui a déjà été payé
  const periodOutstanding = pick(outstanding); // ce qui reste à recevoir
  // ShaQ economics (commission & delivery fee kept separate — see formula).
  const fraisLivraison = data.fraisLivraison || { usd: 0, ghs: 0 };
  const commissionShaq = data.commissionShaq || { usd: 0, ghs: 0 };
  const coutFournisseur = data.coutFournisseur || { usd: 0, ghs: 0 };
  const margeNette = data.margeNette || { usd: 0, ghs: 0 };
  const margeNettePct = data.margeNettePct ?? 0;
  const money = (m) => currency === "GHS"
    ? `₵${(m?.ghs ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `$${(m?.usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const totalShaqFees = { usd: fraisLivraison.usd + commissionShaq.usd, ghs: fraisLivraison.ghs + commissionShaq.ghs };

  const revenueChartData = {
    labels: monthlyData.map((m) => m.month),
    datasets: [
      {
        type: "line",
        label: `Revenue`,
        data: monthlyData.map((m) => m[revKey]),
        borderColor: CHART_COLORS.indigo,
        backgroundColor: CHART_COLORS.indigoAlpha,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: "y",
      },
      {
        type: "bar",
        label: "Collected",
        data: monthlyData.map((m) => m[collectedKey]),
        backgroundColor: CHART_COLORS.emeraldAlpha,
        borderColor: CHART_COLORS.emerald,
        borderWidth: 1.5,
        borderRadius: 4,
        yAxisID: "y",
      },
    ],
  };

  const outstandingChartData = {
    labels: monthlyData.map((m) => m.month),
    datasets: [{
      label: "Outstanding",
      data: monthlyData.map((m) => m[outKey]),
      backgroundColor: CHART_COLORS.roseAlpha,
      borderColor: CHART_COLORS.rose,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
    }],
  };

  const logisticsChartData = {
    labels: monthlyData.map((m) => m.month),
    datasets: [{
      label: "Logistics Cost",
      data: monthlyData.map((m) => m[logKey]),
      backgroundColor: CHART_COLORS.amberAlpha,
      borderColor: CHART_COLORS.amber,
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
    }],
  };

  const dualAxisOpts = {
    ...lineOpts,
    plugins: {
      ...lineOpts.plugins,
      legend: {
        display: true,
        position: "top",
        labels: { color: "#64748b", font: { size: 11 }, padding: 16, boxWidth: 12 },
      },
    },
  };

  const exportCSV = () => {
    const headers = ["Month", `Revenue (${currency})`, `Collected (${currency})`, `Outstanding (${currency})`, `Logistics (${currency})`, "Orders"];
    const rows = monthlyData.map((r) =>
      [r.month, r[revKey], r[collectedKey], r[outKey], r[logKey], r.orders].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "financials.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Financial dashboard</h2>
        <p className="text-sm text-slate-400">Settled data — exact amounts for the period: <span className="font-medium text-indigo-600">{periodLabel}</span></p>
      </div>

      {/* Period Filter + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => { setPeriod(p.value); setShowCustom(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${!showCustom && period === p.value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setShowCustom((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${showCustom ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            Custom
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportFinancePdf({ data, currency, periodLabel })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors w-fit shadow-sm">
            <FileText size={14} /> Export PDF
          </button>
          <button onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors w-fit">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Custom Date Range */}
      {showCustom && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">From</label>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium mb-1 block">To</label>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
          </div>
          <p className="text-xs text-slate-400">The range applies to all amounts below.</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Delivered orders" value={deliveredOrders.toLocaleString()} sub={`Period: ${periodLabel}`} icon={ShoppingBag} accent="emerald" />
        <KpiCard title="Payments received" value={currency === "GHS" ? `₵${collected.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${collected.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="Already paid (delivered)" icon={Wallet} accent="indigo" />
        <KpiCard title="Outstanding balance" value={currency === "GHS" ? `₵${outstanding.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${outstanding.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="Left to collect" icon={Clock} accent="amber" />
        <KpiCard title="COD remittances" value={currency === "GHS" ? `₵${cod.ghs.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${cod.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="Cash on delivery" icon={CreditCard} accent="violet" />
      </div>

      {/* ShaQ economics — commission & delivery fee shown SEPARATELY */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">ShaQ economics (delivered orders)</h2>
            <p className="text-xs text-slate-400">Net margin = revenue − delivery fee − ShaQ commission − supplier cost</p>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">{currency}</span>
        </div>
        <div className="max-w-md space-y-2 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Delivered revenue</span>
            <span className="font-semibold text-slate-800">{money(collected)}</span>
          </div>
          <div className="flex items-center justify-between py-1 pl-4 border-l-2 border-sky-200">
            <span className="text-slate-500">incl. Delivery fee <span className="text-xs text-slate-400">(regional grid)</span></span>
            <span className="font-medium text-sky-700">− {money(fraisLivraison)}</span>
          </div>
          <div className="flex items-center justify-between py-1 pl-4 border-l-2 border-violet-200">
            <span className="text-slate-500">incl. ShaQ commission <span className="text-xs text-slate-400">(5% × price)</span></span>
            <span className="font-medium text-violet-700">− {money(commissionShaq)}</span>
          </div>
          <div className="flex items-center justify-between py-1 border-t border-slate-100 mt-1 pt-2">
            <span className="text-slate-600 font-medium">Total ShaQ fees</span>
            <span className="font-semibold text-slate-700">{money(totalShaqFees)}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-slate-600">Supplier cost <span className="text-xs text-slate-400">(unit cost × qty)</span></span>
            <span className="font-medium text-amber-700">− {money(coutFournisseur)}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t-2 border-slate-200 mt-1">
            <span className="text-slate-800 font-bold">Net margin</span>
            <span className="font-bold text-emerald-600">{money(margeNette)} <span className="text-xs text-slate-400 font-medium">({margeNettePct}%)</span></span>
          </div>
        </div>
      </div>

      {/* Financial Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Already Collected",
            value: `${sym}${periodCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            pct: periodRevenue ? ((periodCollected / periodRevenue) * 100).toFixed(1) : 0,
            color: "border-emerald-400",
            textColor: "text-emerald-700",
            bg: "bg-emerald-50",
            icon: TrendingUp,
            desc: "Payments received for period",
          },
          {
            title: "Remaining to Collect",
            value: `${sym}${periodOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            pct: periodRevenue ? ((periodOutstanding / periodRevenue) * 100).toFixed(1) : 0,
            color: "border-amber-400",
            textColor: "text-amber-700",
            bg: "bg-amber-50",
            icon: Clock,
            desc: "Pending remittances & unpaid",
          },
          {
            title: "Net Financial Position",
            value: `${sym}${(periodCollected - periodOutstanding).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            pct: null,
            color: "border-indigo-400",
            textColor: "text-indigo-700",
            bg: "bg-indigo-50",
            icon: DollarSign,
            desc: "Collected minus outstanding",
          },
        ].map((card) => (
          <div key={card.title} className={`bg-white rounded-2xl border-l-4 ${card.color} shadow-sm border border-slate-100 p-5`}>
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
              <card.icon size={18} className={card.textColor} />
            </div>
            <p className="text-xs text-slate-500 font-medium">{card.title}</p>
            <p className={`text-xl font-bold mt-1 ${card.textColor}`}>{card.value}</p>
            {card.pct !== null && (
              <p className="text-xs text-slate-400 mt-0.5">{card.pct}% of period revenue</p>
            )}
            <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Revenue vs Collected Chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Revenue vs Collected Amounts</h2>
            <p className="text-xs text-slate-400">Monthly comparison — {currency}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-indigo-500 rounded" /> Revenue</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-500" /> Collected</div>
          </div>
        </div>
        <div className="h-64"><Bar data={revenueChartData} options={dualAxisOpts} /></div>
      </div>

      {/* Outstanding + Logistics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">Outstanding Balance Evolution</h2>
            <p className="text-xs text-slate-400">Monthly pending amounts — {currency}</p>
          </div>
          <div className="h-52"><Line data={outstandingChartData} options={lineOpts} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800">COD Remittance Trends</h2>
            <p className="text-xs text-slate-400">Logistics cost over time — {currency}</p>
          </div>
          <div className="h-52"><Line data={logisticsChartData} options={lineOpts} /></div>
        </div>
      </div>

      {/* Monthly Financial Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Financial Summary by Period</h2>
            <p className="text-xs text-slate-400">Revenue, collected, outstanding — {currency}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Month</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Revenue</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Collected</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Outstanding</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Logistics</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Orders</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">MoM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyData.map((row, idx) => {
                const prevRow = monthlyData[idx - 1];
                const change = prevRow ? (((row[revKey] - prevRow[revKey]) / prevRow[revKey]) * 100).toFixed(1) : null;
                return (
                  <tr key={row.month} className={`hover:bg-indigo-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-3 text-slate-700 font-medium text-xs">{row.month}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 text-xs">{sym}{row[revKey].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium text-xs">{sym}{row[collectedKey].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium text-xs">{sym}{row[outKey].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell text-xs">{sym}{row[logKey].toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="px-4 py-3 text-right text-slate-600 text-xs">{row.orders}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {change !== null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${parseFloat(change) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {parseFloat(change) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {Math.abs(change)}%
                        </span>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 border-t-2 border-indigo-100">
                <td className="px-4 py-3 text-sm font-bold text-slate-800">Total</td>
                <td className="px-4 py-3 text-right font-bold text-indigo-700 text-xs">{sym}{periodRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700 text-xs">{sym}{periodCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-700 text-xs">{sym}{periodOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 hidden md:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-slate-700 text-xs">{monthlyData.reduce((s, r) => s + r.orders, 0)}</td>
                <td className="px-4 py-3 hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Additional metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Delivery Success Rate", value: `${deliveryRate}%`, sub: "Orders delivered", color: "text-emerald-600", bg: "bg-emerald-50", icon: TrendingUp },
          { label: "Return Rate", value: `${returnRate}%`, sub: "Orders returned/refunded", color: "text-rose-600", bg: "bg-rose-50", icon: TrendingDown },
          { label: "Exchange Rate", value: `1 USD = ₵${usdToGhs}`, sub: "Fixed reference rate", color: "text-indigo-600", bg: "bg-indigo-50", icon: DollarSign },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <m.icon size={22} className={m.color} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{m.label}</p>
              <p className={`text-xl font-bold ${m.color} mt-0.5`}>{m.value}</p>
              <p className="text-xs text-slate-400">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
