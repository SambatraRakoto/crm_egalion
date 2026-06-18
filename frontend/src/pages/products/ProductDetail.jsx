import { ArrowLeft, Package, Tag, Hash, ShoppingCart } from "lucide-react";
import { Line, Bar } from "react-chartjs-2";
import { STATUS_BADGE } from "../../lib/mockProducts";
import { ORDERS, USD_TO_GHS } from "../../lib/mockData";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const chartOpts = {
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

export default function ProductDetail({ product, currency, onBack }) {
  const sym = currency === "GHS" ? "₵" : "$";
  const priceKey = currency === "GHS" ? "priceGHS" : "priceUSD";
  const rate = currency === "GHS" ? USD_TO_GHS : 1;

  const revenueUSD = parseFloat((product.priceUSD * product.sold).toFixed(2));
  const revenueDisplay = currency === "GHS" ? `₵${(revenueUSD * USD_TO_GHS).toLocaleString()}` : `$${revenueUSD.toLocaleString()}`;

  // Related orders (mock: match by product name fragment)
  const relatedOrders = ORDERS.filter((o) =>
    o.product.toLowerCase().includes(product.name.split(" ")[0].toLowerCase())
  ).slice(0, 8);

  const salesTrendData = {
    labels: MONTHS,
    datasets: [{
      label: "Revenue",
      data: product.salesByMonth.map((m) => parseFloat((m.revenue * rate).toFixed(2))),
      borderColor: "rgba(79,70,229,1)",
      backgroundColor: "rgba(79,70,229,0.12)",
      fill: true, tension: 0.4,
      pointBackgroundColor: "rgba(79,70,229,1)", pointRadius: 3, borderWidth: 2,
    }],
  };

  const invHistData = {
    labels: product.inventoryHistory.map((h) => h.month.slice(5)),
    datasets: [
      {
        label: "Added",
        data: product.inventoryHistory.map((h) => h.added),
        backgroundColor: "rgba(16,185,129,0.7)",
        borderRadius: 4,
      },
      {
        label: "Sold",
        data: product.inventoryHistory.map((h) => h.sold),
        backgroundColor: "rgba(244,63,94,0.7)",
        borderRadius: 4,
      },
    ],
  };
  const invHistOpts = {
    ...chartOpts,
    plugins: { ...chartOpts.plugins, legend: { display: true, labels: { color: "#64748b", font: { size: 11 }, boxWidth: 12 } } },
  };

  const stockStatus = product.inventory === 0 ? { label: "Out of Stock", color: "text-rose-600 bg-rose-50" }
    : product.inventory <= 15 ? { label: "Low Stock", color: "text-amber-600 bg-amber-50" }
    : { label: "In Stock", color: "text-emerald-600 bg-emerald-50" };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Products
        </button>
      </div>

      {/* Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Gallery */}
        <div className="space-y-3">
          <img src={product.image} alt={product.name}
            className="w-full h-56 object-cover rounded-2xl border border-slate-100 shadow-sm" />
          <div className="grid grid-cols-3 gap-2">
            {product.gallery.slice(1).map((img, i) => (
              <img key={i} src={img} alt="" className="w-full h-16 object-cover rounded-xl border border-slate-100" />
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
                <p className="text-slate-400 text-sm mt-0.5">{product.shopifyId}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${STATUS_BADGE[product.status]}`}>{product.status}</span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">{product.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Tag, label: "Price", value: `${sym}${product[priceKey].toLocaleString()}` },
                { icon: Package, label: "Inventory", value: product.inventory },
                { icon: ShoppingCart, label: "Sold", value: product.sold },
                { icon: Hash, label: "SKU", value: product.sku },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Performance KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Revenue", value: revenueDisplay, color: "text-indigo-600", bg: "bg-indigo-50" },
              { label: "Stock Status", value: stockStatus.label, color: stockStatus.color.split(" ")[0], bg: stockStatus.color.split(" ")[1] },
              { label: "Category", value: product.category, color: "text-slate-700", bg: "bg-slate-50" },
              { label: "Created", value: product.createdDate, color: "text-slate-700", bg: "bg-slate-50" },
            ].map((m) => (
              <div key={m.label} className={`${m.bg} rounded-2xl p-4`}>
                <p className="text-xs text-slate-500 font-medium">{m.label}</p>
                <p className={`text-sm font-bold mt-0.5 ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Variants */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Variants ({product.variants.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 rounded-xl">
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Size</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">Color</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2">SKU</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-3 py-2">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {product.variants.map((v, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-slate-700 font-medium">{v.size}</td>
                  <td className="px-3 py-2 text-slate-500">{v.color}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{v.sku}</td>
                  <td className="px-3 py-2 text-right">
                    {v.stock === 0 ? <span className="text-xs text-rose-600 font-semibold">Out</span>
                      : v.stock <= 5 ? <span className="text-xs text-amber-600 font-semibold">{v.stock}</span>
                      : <span className="text-xs text-slate-600">{v.stock}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Sales Revenue Trend</h3>
          <p className="text-xs text-slate-400 mb-4">Monthly — {currency}</p>
          <div className="h-48"><Line data={salesTrendData} options={chartOpts} /></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Inventory Movement</h3>
          <p className="text-xs text-slate-400 mb-4">Stock added vs sold (12 months)</p>
          <div className="h-48"><Bar data={invHistData} options={invHistOpts} /></div>
        </div>
      </div>

      {/* Recent Orders */}
      {relatedOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Recent Orders</h3>
            <p className="text-xs text-slate-400">Orders containing this product</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Order ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Customer</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 hidden sm:table-cell">Region</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {relatedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-mono text-xs text-indigo-600 font-semibold">{o.id}</td>
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{o.customer}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs hidden sm:table-cell">{o.region}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${o.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : o.status === "In Transit" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                      {currency === "GHS" ? `₵${o.amountGHS.toLocaleString()}` : `$${o.amountUSD.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">{o.date}</td>
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