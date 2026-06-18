import { useState } from "react";
import { List, BarChart2, RefreshCw, Plus } from "lucide-react";
import ProductList from "./products/ProductList";
import ProductAnalytics from "./products/ProductAnalytics";
import ShopifySync from "./products/ShopifySync";
import ProductDetail from "./products/ProductDetail";
import ProductFormModal from "../components/products/ProductFormModal";
import InventoryAlerts from "../components/products/InventoryAlerts";

const TABS = [
  { id: "list", label: "Catalog", icon: List },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
  { id: "sync", label: "Shopify Sync", icon: RefreshCw },
];

export default function Products({ currency }) {
  const [tab, setTab] = useState("list");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  if (selectedProduct) {
    return (
      <ProductDetail
        product={selectedProduct}
        currency={currency}
        onBack={() => setSelectedProduct(null)}
        onEdit={(p) => { setEditProduct(p); setSelectedProduct(null); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Tab Bar + New Product */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white rounded-2xl border border-slate-100 shadow-sm p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        {tab === "list" && (
          <button
            onClick={() => setShowNewProduct(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={15} /> New Product
          </button>
        )}
      </div>

      {/* Inventory Alerts (shown on catalog tab) */}
      {tab === "list" && <InventoryAlerts />}

      {tab === "list" && (
        <ProductList
          currency={currency}
          onSelectProduct={setSelectedProduct}
          onEditProduct={(p) => setEditProduct(p)}
        />
      )}
      {tab === "analytics" && <ProductAnalytics currency={currency} />}
      {tab === "sync" && <ShopifySync />}

      {/* New / Edit Product Modal */}
      {(showNewProduct || editProduct) && (
        <ProductFormModal
          product={editProduct}
          onClose={() => { setShowNewProduct(false); setEditProduct(null); }}
        />
      )}
    </div>
  );
}