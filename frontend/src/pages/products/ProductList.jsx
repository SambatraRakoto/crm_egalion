import { useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, Edit3 } from "lucide-react";
import { PRODUCT_CATEGORIES, STATUS_BADGE, PRODUCT_STATUS } from "../../lib/mockProducts";
import { useProducts } from "@/hooks/useProducts";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { label: "Newest First", key: "createdDate", dir: "desc" },
  { label: "Oldest First", key: "createdDate", dir: "asc" },
  { label: "Price: High → Low", key: "priceUSD", dir: "desc" },
  { label: "Price: Low → High", key: "priceUSD", dir: "asc" },
  { label: "Best Selling", key: "sold", dir: "desc" },
  { label: "Inventory: Low → High", key: "inventory", dir: "asc" },
];

export default function ProductList({ currency, onSelectProduct, onEditProduct }) {
  const { data: products = [], isLoading, isError, error, refetch } = useProducts();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortIdx, setSortIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const sym = currency === "GHS" ? "₵" : "$";
  const priceKey = currency === "GHS" ? "priceGHS" : "priceUSD";

  const filtered = useMemo(() => {
    let data = [...products];
    if (filterCat !== "All") data = data.filter((p) => p.category === filterCat);
    if (filterStatus !== "All") data = data.filter((p) => p.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    const sort = SORT_OPTIONS[sortIdx];
    data.sort((a, b) => {
      if (sort.dir === "asc") return a[sort.key] > b[sort.key] ? 1 : -1;
      return a[sort.key] < b[sort.key] ? 1 : -1;
    });
    return data;
  }, [products, search, filterCat, filterStatus, sortIdx]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageData = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  const handleFilter = () => setPage(1);
  const toggleSelect = (id) => setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected(selected.size === pageData.length ? new Set() : new Set(pageData.map((p) => p.id)));

  const stockBadge = (inv) => {
    if (inv === 0) return <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Out of stock</span>;
    if (inv <= 15) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Low stock</span>;
    return <span className="text-xs font-medium text-slate-500">{inv}</span>;
  };

  if (isLoading) return <LoadingState label="Loading products…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load products" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Products</h2>
          <p className="text-sm text-slate-400">{filtered.length} products from Shopify</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium">{selected.size} selected</span>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all ${showFilters ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" placeholder="Search by name, SKU, category…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400"
          />
        </div>
        <select
          value={sortIdx}
          onChange={(e) => { setSortIdx(+e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600"
        >
          {SORT_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
        </select>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {["All", ...PRODUCT_CATEGORIES].map((cat) => (
                <button key={cat} onClick={() => { setFilterCat(cat); handleFilter(); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterCat === cat ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">Status</p>
            <div className="flex gap-1.5">
              {["All", ...PRODUCT_STATUS].map((s) => (
                <button key={s} onClick={() => { setFilterStatus(s); handleFilter(); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === pageData.length && pageData.length > 0} onChange={toggleAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Product</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">SKU</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Category</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Price</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Inventory</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 hidden xl:table-cell">Created</th>
                <th className="w-12 px-4 py-3" />
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pageData.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No products found.</td></tr>
              ) : pageData.map((p, idx) => (
                <tr key={p.id}
                  onClick={() => onSelectProduct(p)}
                  className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name}
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-slate-100"
                        onError={(e) => { e.target.style.display = "none"; }} />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 hidden md:table-cell">{p.sku}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.category}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{sym}{p[priceKey].toLocaleString()}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">{stockBadge(p.inventory)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden xl:table-cell">{p.createdDate}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onEditProduct?.(p)}
                      className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit3 size={13} />
                    </button>
                  </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600">{Math.min((curPage - 1) * PAGE_SIZE + 1, filtered.length)}</span>–<span className="font-semibold text-slate-600">{Math.min(curPage * PAGE_SIZE, filtered.length)}</span> of <span className="font-semibold text-slate-600">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={curPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = Math.max(1, Math.min(curPage - 2, totalPages - 4)) + i;
              return (
                <button key={n} onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${n === curPage ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"}`}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={curPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}