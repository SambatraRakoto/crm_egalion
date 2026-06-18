import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { STATUS_CATEGORIES } from "@/lib/orderStatus";
import { useCreateOrder } from "@/hooks/useOrders";

/** Create a new order (POST /orders). */
export default function OrderCreateModal({ onClose }) {
  const createOrder = useCreateOrder();
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    region: "",
    product: "",
    status: "Pending",
    amountGHS: "",
    deliveryCostGHS: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createOrder.mutateAsync({
        ...form,
        amountGHS: parseFloat(form.amountGHS) || 0,
        deliveryCostGHS: parseFloat(form.deliveryCostGHS) || 0,
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create order");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">New order</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer</label>
              <input value={form.customer} onChange={(e) => set("customer", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Region</label>
                <input value={form.region} onChange={(e) => set("region", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Product</label>
              <input value={form.product} onChange={(e) => set("product", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (GHS)</label>
                <input type="number" min="0" step="0.01" value={form.amountGHS} onChange={(e) => set("amountGHS", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery fee (GHS)</label>
                <input type="number" min="0" step="0.01" value={form.deliveryCostGHS} onChange={(e) => set("deliveryCostGHS", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Delivery status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
                {Object.entries(STATUS_CATEGORIES).map(([cat, statuses]) => (
                  <optgroup key={cat} label={cat}>
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
            </div>
          </div>

          <div className="flex flex-col gap-2 px-5 py-4 border-t border-slate-100">
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={createOrder.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={createOrder.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {createOrder.isPending && <Loader2 size={14} className="animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
