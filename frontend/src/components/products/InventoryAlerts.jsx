import { AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useProducts } from "@/hooks/useProducts";

export default function InventoryAlerts() {
  const [showLow, setShowLow] = useState(false);
  const [showOut, setShowOut] = useState(false);
  const { data: products = [] } = useProducts();

  const lowStock = products.filter((p) => p.inventory > 0 && p.inventory <= 15);
  const outOfStock = products.filter((p) => p.inventory === 0);

  if (!lowStock.length && !outOfStock.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Low Stock */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowLow((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-amber-800">Low Stock Alert</p>
                <p className="text-xs text-amber-600">{lowStock.length} products running low</p>
              </div>
            </div>
            {showLow ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
          </button>
          {showLow && (
            <div className="border-t border-amber-200 divide-y divide-amber-100 max-h-48 overflow-y-auto">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-amber-900">{p.name}</p>
                    <p className="text-xs text-amber-600 font-mono">{p.sku}</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {p.inventory} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Out of Stock */}
      {outOfStock.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowOut((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <XCircle size={16} className="text-rose-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-rose-800">Out of Stock</p>
                <p className="text-xs text-rose-600">{outOfStock.length} products unavailable</p>
              </div>
            </div>
            {showOut ? <ChevronUp size={16} className="text-rose-600" /> : <ChevronDown size={16} className="text-rose-600" />}
          </button>
          {showOut && (
            <div className="border-t border-rose-200 divide-y divide-rose-100 max-h-48 overflow-y-auto">
              {outOfStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-rose-900">{p.name}</p>
                    <p className="text-xs text-rose-500 font-mono">{p.sku}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    Out of stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}