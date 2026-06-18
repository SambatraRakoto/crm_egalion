import { useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { PRODUCT_CATEGORIES, PRODUCT_STATUS } from "../../lib/mockProducts";
import { USD_TO_GHS } from "../../lib/mockData";
import { useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";

const EMPTY_FORM = {
  name: "",
  sku: "",
  category: PRODUCT_CATEGORIES[0],
  priceGHS: "",
  inventory: "",
  status: "Active",
  description: "",
  weight: "",
  tags: "",
};

export default function ProductFormModal({ product, onClose }) {
  const isEdit = !!product;
  const [form, setForm] = useState(
    isEdit
      ? {
          name: product.name,
          sku: product.sku,
          category: product.category,
          priceGHS: product.priceGHS,
          inventory: product.inventory,
          status: product.status,
          description: product.description || "",
          weight: product.weight || "",
          tags: (product.tags || []).join(", "),
        }
      : EMPTY_FORM
  );

  const [error, setError] = useState("");
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const saving = createProduct.isPending || updateProduct.isPending;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      priceGHS: parseFloat(form.priceGHS) || 0,
      inventory: parseInt(form.inventory, 10) || 0,
      status: form.status,
      description: form.description,
      weight: form.weight,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };
    try {
      if (isEdit) {
        await updateProduct.mutateAsync({ id: product.id, payload });
      } else {
        await createProduct.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to save product");
    }
  };

  const priceUSDPreview = form.priceGHS ? (parseFloat(form.priceGHS) / USD_TO_GHS).toFixed(2) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-900">{isEdit ? "Edit Product" : "New Product"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">
            {/* Image Upload Placeholder */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center gap-2 text-center hover:border-indigo-300 transition-colors cursor-pointer">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Upload size={18} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">Upload Product Image</p>
              <p className="text-xs text-slate-400">PNG, JPG up to 10MB</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Product Name <span className="text-rose-500">*</span></label>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Ankara Fabric 6 yards"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">SKU <span className="text-rose-500">*</span></label>
                <input required value={form.sku} onChange={(e) => set("sku", e.target.value)}
                  placeholder="e.g. SKU-GH-1001"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Category</label>
                <select value={form.category} onChange={(e) => set("category", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Price (GHS) <span className="text-rose-500">*</span></label>
                <input required type="number" min="0" step="0.01" value={form.priceGHS} onChange={(e) => set("priceGHS", e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
                {priceUSDPreview && <p className="text-xs text-slate-400 mt-1">≈ ${priceUSDPreview} USD</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Stock <span className="text-rose-500">*</span></label>
                <input required type="number" min="0" value={form.inventory} onChange={(e) => set("inventory", e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-white">
                  {PRODUCT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Weight</label>
                <input value={form.weight} onChange={(e) => set("weight", e.target.value)}
                  placeholder="e.g. 0.5 kg"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tags</label>
                <input value={form.tags} onChange={(e) => set("tags", e.target.value)}
                  placeholder="e.g. Ghana, Fashion, Wholesale"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                  rows={3} placeholder="Product description…"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 sticky bottom-0 bg-white rounded-b-2xl">
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {isEdit ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}