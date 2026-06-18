import { Bar, Line, Doughnut } from "react-chartjs-2";
import { TrendingUp, Package, AlertTriangle, XCircle, DollarSign, Archive } from "lucide-react";
import KpiCard from "../../components/crm/KpiCard";
import {
  getProductKPIs, getBestSellingProductsData, getRevenuePerProduct,
  getCategoryPerformance, getSalesTrendData,
} from "../../lib/mockProducts";
import { USD_TO_GHS } from "../../lib/mockData";
import { useProducts } from "@/hooks/useProducts";
import { LoadingState } from "@/components/feedback/LoadingState";
import { EmptyState } from "@/components/feedback/EmptyState";

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8 },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { size: 11 } } },
    y: { grid: { color: "#f1f5f9" }, ticks: { color: "#94a3b8", font: { size: 11 } } },
  },
};

const PALETTE = ["rgba(79,70,229,0.85)","rgba(16,185,129,0.85)","rgba(245,158,11,0.85)","rgba(244,63,94,0.85)","rgba(139,92,246,0.85)","rgba(14,165,233,0.85)","rgba(249,115,22,0.85)","rgba(20,184,166,0.85)"];

export default function ProductAnalytics({ currency }) {
  const { data: products = [], isLoading } = useProducts();

  const kpis = getProductKPIs(products);
  const bestSelling = getBestSellingProductsData(products);
  const revPerProduct = getRevenuePerProduct(products);
  const catPerf = getCategoryPerformance(products);
  const salesTrend = getSalesTrendData(products);
  const rate = currency === "GHS" ? USD_TO_GHS : 1;
  const sym = currency === "GHS" ? "₵" : "$";

  const lowStock = products.filter((p) => p.inventory > 0 && p.inventory <= (p.lowStockThreshold ?? 15));
  const outOfStock = products.filter((p) => p.inventory === 0);

  if (isLoading) return <LoadingState label="Loading analytics…" />;
  if (!products.length) {
    return <EmptyState icon={Package} title="No products yet" description="Add a product or run a Shopify sync to see analytics here." />;
  }

  const bestSellingChart = {
    labels: bestSelling.map((p) => p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name),
    datasets: [{ label: "Units Sold", data: bestSelling.map((p) => p.sold), backgroundColor: PALETTE, borderRadius: 6, borderSkipped: false }],
  };

  const revChart = {
    labels: revPerProduct.map((p) => p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name),
    datasets: [{
      label: `Revenue (${currency})`,
      data: revPerProduct.map((p) => parseFloat((p.revenueUSD * rate).toFixed(2))),
      backgroundColor: "rgba(79,70,229,0.15)", borderColor: "rgba(79,70,229,1)",
      borderWidth: 2, borderRadius: 6,
    }],
  };

  const salesTrendChart = {
    labels: salesTrend.labels,
    datasets: [{
      label: `Revenue (${currency})`,
      data: salesTrend.data.map((v) => parseFloat((v * rate).toFixed(2))),
      borderColor: "rgba(16,185,129,1)", backgroundColor: "rgba(16,185,129,0.12)",
      fill: true, tension: 0.4, pointBackgroundColor: "rgba(16,185,129,1)", pointRadius: 3, borderWidth: 2,
    }],
  };

  const stockStatusChart = {
    labels: ["In Stock", "Low Stock", "Out of Stock"],
    datasets: [{
      data: [
        products.filter((p) => p.inventory > (p.lowStockThreshold ?? 15)).length,
        lowStock.length,
        outOfStock.length,
      ],
      backgroundColor: ["rgba(16,185,129,0.85)", "rgba(245,158,11,0.85)", "rgba(244,63,94,0.85)"],
      borderWidth: 2, borderColor: "#fff",
    }],
  };

  const donutOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom", labels: { color: "#64748b", font: { size: 11 }, padding: 12, boxWidth: 12 } },
      tooltip: { backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#cbd5e1", padding: 10, cornerRadius: 8 },
    },
    cutout: "62%",
  };

  const hBarOpts = { ...chartOpts, indexAxis: "y" };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Products" value={kpis.total} sub="In catalog" icon={Package} accent="indigo" />
        <KpiCard title="Active" value={kpis.active} sub="Live on Shopify" icon={TrendingUp} accent="emerald" />
        <KpiCard title="Low Stock" value={kpis.lowStock} sub="≤15 units left" icon={AlertTriangle} accent="amber" />
        <KpiCard title="Out of Stock" value={kpis.outOfStock} sub="Needs restocking" icon={XCircle} accent="rose" />
        <KpiCard
          title="Inventory Value"
          value={`${sym}${(kpis.totalInventoryValueUSD * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="At selling price"
          icon={DollarSign}
          accent="violet"
        />
        <KpiCard
          title="Total Revenue"
          value={`${sym}${(kpis.totalRevUSD * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="From all sales"
          icon={Archive}
          accent="sky"
        />
      </div>

      {/* Best Selling + Revenue Per Product */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Best-Selling Products</h3>
          <p className="text-xs text-slate-400 mb-4">Top 10 by units sold</p>
          <div className="h-64"><Bar data={bestSellingChart} options={hBarOpts} /></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Revenue per Product</h3>
          <p className="text-xs text-slate-400 mb-4">Top 8 by revenue — {currency}</p>
          <div className="h-64"><Bar data={revChart} options={hBarOpts} /></div>
        </div>
      </div>

      {/* Sales Trend + Stock Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Product Sales Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly combined revenue — {currency}</p>
          <div className="h-52"><Line data={salesTrendChart} options={chartOpts} /></div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Inventory Status Overview</h3>
          <p className="text-xs text-slate-400 mb-4">Stock distribution</p>
          <div className="h-52"><Doughnut data={stockStatusChart} options={donutOpts} /></div>
        </div>
      </div>

      {/* Category Performance Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Top-Performing Categories</h3>
          <p className="text-xs text-slate-400">Ranked by revenue generated</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">#</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Category</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Products</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Units Sold</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Revenue</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {catPerf.map((cat, i) => {
                const totalRev = catPerf.reduce((s, c) => s + c.revenue, 0);
                const pct = ((cat.revenue / totalRev) * 100).toFixed(1);
                return (
                  <tr key={cat.cat} className={`hover:bg-indigo-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                    <td className="px-4 py-3 text-slate-400 text-xs font-bold">#{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{cat.cat}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{cat.count}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{cat.sold}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                      {sym}{(cat.revenue * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-10">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock + Out of Stock Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/40">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" /> Low Stock ({lowStock.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.sku}</p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{p.inventory} left</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/40">
            <h3 className="text-sm font-semibold text-rose-800 flex items-center gap-2">
              <XCircle size={15} className="text-rose-500" /> Out of Stock ({outOfStock.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
            {outOfStock.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">0 units</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}