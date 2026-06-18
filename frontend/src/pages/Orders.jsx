import { useState, useMemo, useCallback } from "react";
import {
  Search, ChevronLeft, ChevronRight, Download, ExternalLink,
  Archive, Edit3, ChevronDown, Calendar, X,
} from "lucide-react";
import { STATUS_CATEGORIES, STATUS_COLORS } from "@/lib/orderStatus";
import { USD_TO_GHS } from "@/lib/mockData";
import {
  useOrders, useUpdateOrder, useArchiveOrder, useRestoreOrder, useBulkUpdateOrders, useDeleteOrder,
} from "@/hooks/useOrders";
import { useAuth } from "@/lib/AuthContext";
import { useShipOrder } from "@/hooks/useShaq";
import { useConfirm } from "@/hooks/useConfirm";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import OrderEditModal from "../components/orders/OrderEditModal";
import OrderCreateModal from "../components/orders/OrderCreateModal";
import BulkActionBar from "../components/orders/BulkActionBar";
import { Plus, Trash2, Send, Truck, ArchiveRestore } from "lucide-react";

const FILTER_TABS = ["All", ...Object.keys(STATUS_CATEGORIES)];
const PAGE_SIZE = 25;
const DATE_PRESETS = ["Yesterday", "Today", "This Week", "This Month", "Custom"];

function getPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (preset === "Today") return { from: today, to: today };
  if (preset === "Yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: y, to: y };
  }
  if (preset === "This Week") {
    const mon = new Date(today); mon.setDate(today.getDate() - today.getDay() + 1);
    return { from: mon, to: today };
  }
  if (preset === "This Month") {
    return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
  }
  return null;
}

function inRange(dateStr, range) {
  if (!range) return true;
  const d = new Date(dateStr);
  return d >= range.from && d <= range.to;
}

// Format a date string to a more readable format e.g. "Jun 12, 2025"
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

export default function Orders({ currency }) {
  // ─── Data (React Query) ──────────────────────────────────────────────────
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();
  const updateOrder = useUpdateOrder();
  const archiveOrder = useArchiveOrder();
  const restoreOrder = useRestoreOrder();
  const bulkUpdate = useBulkUpdateOrders();
  const deleteOrder = useDeleteOrder();
  const shipOrder = useShipOrder();
  const { hasRole } = useAuth();
  const { confirm, alert, dialog } = useConfirm();
  const canDelete = hasRole("admin") || hasRole("super_admin");
  const canShip = hasRole("admin") || hasRole("super_admin") || hasRole("manager");

  const handleShip = (order) => {
    shipOrder.mutate(order.id, {
      onError: (e) => alert({ title: "Send to ShaQ failed", message: e?.message || "Failed to send to ShaQ" }),
    });
  };

  const handleDelete = async (order) => {
    const ok = await confirm({
      title: "Delete order",
      message: `Delete order ${order.orderNumber || order.id}? This cannot be undone.`,
      variant: "danger",
      confirmLabel: "Delete",
    });
    if (ok) deleteOrder.mutate(order.id);
  };

  // ─── Local UI state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [page, setPage] = useState(1);
  const [datePreset, setDatePreset] = useState(null);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [editOrder, setEditOrder] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const archivedCount = useMemo(() => orders.filter((o) => o.archived).length, [orders]);

  const dateRange = useMemo(() => {
    if (datePreset === "Custom" && customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    if (datePreset && datePreset !== "Custom") return getPresetRange(datePreset);
    return null;
  }, [datePreset, customFrom, customTo]);

  const filtered = useMemo(() => {
    let data = orders.filter((o) => (showArchived ? o.archived : !o.archived));
    if (activeTab !== "All") data = data.filter((o) => o.category === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.region.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    }
    if (dateRange) data = data.filter((o) => inRange(o.date, dateRange));
    return data;
  }, [search, activeTab, orders, dateRange, showArchived]);

  // Counts per tab (memoized separately to avoid recomputing on pagination changes)
  const tabCounts = useMemo(() => {
    const scope = orders.filter((o) => (showArchived ? o.archived : !o.archived));
    const counts = { All: scope.length };
    Object.keys(STATUS_CATEGORIES).forEach((cat) => {
      counts[cat] = scope.filter((o) => o.category === cat).length;
    });
    return counts;
  }, [orders, showArchived]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleTabChange = useCallback((tab) => { setActiveTab(tab); setPage(1); setSelected(new Set()); }, []);
  const handleSearch = useCallback((e) => { setSearch(e.target.value); setPage(1); }, []);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => prev.size === pageData.length ? new Set() : new Set(pageData.map((o) => o.id)));
  }, [pageData]);

  const handleArchiveSelected = useCallback(() => {
    // In the archived view this acts as "unarchive".
    bulkUpdate.mutate({ ids: [...selected], archived: !showArchived });
    setSelected(new Set());
  }, [selected, bulkUpdate, showArchived]);

  const handleBulkStatus = useCallback((status) => {
    bulkUpdate.mutate({ ids: [...selected], status });
    setSelected(new Set());
  }, [selected, bulkUpdate]);

  const handleBulkNote = useCallback((note) => {
    bulkUpdate.mutate({ ids: [...selected], notes: note });
    setSelected(new Set());
  }, [selected, bulkUpdate]);

  const handleSaveEdit = useCallback((updated) => {
    updateOrder.mutate({
      id: updated.id,
      payload: {
        customer: updated.customer,
        phone: updated.phone,
        region: updated.region,
        status: updated.status,
        notes: updated.notes,
      },
    });
    setEditOrder(null);
  }, [updateOrder]);

  const exportCSV = () => {
    const headers = ["Order ID", "Customer", "Phone", "Region", "Product", "Status", "Amount (USD)", "Delivery Cost (USD)", "Date"];
    const rows = filtered.map((o) =>
      [o.id, `"${o.customer}"`, o.phone, o.region, `"${o.product}"`, o.status, o.amountUSD, o.deliveryCostUSD, o.date].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const clearDateFilter = () => { setDatePreset(null); setCustomFrom(""); setCustomTo(""); setShowDatePicker(false); };

  const pageNumbers = () => {
    const pages = [];
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) pages.push(i);
    return pages;
  };

  const fmtAmt = (o) => currency === "GHS"
    ? `₵${o.amountGHS.toLocaleString()}`
    : `$${o.amountUSD.toLocaleString()}`;

  // Money formatter with mock fallback (compute GHS from USD when missing).
  const money = (usd, ghs) => {
    const g = ghs ?? (usd ?? 0) * USD_TO_GHS;
    return currency === "GHS"
      ? `₵${(g ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `$${(usd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  // Per-row derived values (work in both mock and real mode).
  const derive = (o) => {
    const isDelivered = ["Delivered", "Confirmed"].includes(o.status);
    return {
      quantity: o.quantity ?? (o.items?.[0]?.quantity ?? 1),
      unitUSD: o.unitPriceUSD ?? o.amountUSD,
      unitGHS: o.unitPriceGHS,
      commissionUSD: o.commissionShaqUSD ?? Number((o.amountUSD * 0.05).toFixed(2)),
      commissionGHS: o.commissionShaqGHS,
      deliveredAt: o.deliveredAt || (isDelivered ? o.updatedAt : null),
    };
  };

  if (isLoading) return <LoadingState label="Loading orders…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} title="Could not load orders" />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Orders</h2>
          <p className="text-sm text-slate-400">
            <span className="font-semibold text-slate-600">{filtered.length.toLocaleString()}</span> {showArchived ? "archived orders" : "orders"}
            {activeTab !== "All" && <span className="text-indigo-500 font-medium"> · {activeTab}</span>}
            {datePreset && <span className="text-indigo-500 font-medium"> · {datePreset}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowArchived((v) => !v); setPage(1); setSelected(new Set()); }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-colors w-fit border ${
              showArchived ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}>
            <Archive size={15} /> {showArchived ? "View active" : "Archived"}
            {archivedCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${showArchived ? "bg-amber-200 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{archivedCount}</span>
            )}
          </button>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm w-fit">
            <Plus size={15} /> New order
          </button>
          <button onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors w-fit">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Search + Date Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, customer, product, region, status…"
            value={search}
            onChange={handleSearch}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors border ${
              datePreset
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Calendar size={14} />
            <span className="whitespace-nowrap">{datePreset || "Date Filter"}</span>
            {datePreset
              ? <button onClick={(e) => { e.stopPropagation(); clearDateFilter(); }} className="ml-1 hover:text-indigo-900"><X size={12} /></button>
              : <ChevronDown size={13} className="text-slate-400" />
            }
          </button>
          {showDatePicker && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 w-52">
              {DATE_PRESETS.map((p) => (
                <button key={p}
                  onClick={() => { setDatePreset(p); if (p !== "Custom") setShowDatePicker(false); setPage(1); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${datePreset === p ? "bg-indigo-50 text-indigo-700 font-medium" : "hover:bg-slate-50 text-slate-600"}`}>
                  {p}
                </button>
              ))}
              {datePreset === "Custom" && (
                <div className="pt-2 space-y-2 border-t border-slate-100 mt-1">
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                  <button onClick={() => setShowDatePicker(false)}
                    className="w-full py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-medium">Apply</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map((tab) => (
          <button key={tab} onClick={() => handleTabChange(tab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
            }`}>
            {tab}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === tab ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>
              {tabCounts[tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          archived={showArchived}
          onArchive={handleArchiveSelected}
          onBulkStatus={handleBulkStatus}
          onBulkNote={handleBulkNote}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={pageData.length > 0 && selected.size === pageData.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Order</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Region</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Product</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Qty</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Unit price</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Delivery fee</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Commission ShaQ</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Date</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-3">Delivered at</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-16 text-slate-400 text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Search size={32} className="text-slate-200" />
                      <span>No orders match your filters</span>
                      {(search || activeTab !== "All" || datePreset) && (
                        <button onClick={() => { setSearch(""); setActiveTab("All"); clearDateFilter(); }}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium mt-1">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageData.map((order) => { const d = derive(order); return (
                  <tr key={order.id}
                    className={`border-b border-slate-50 hover:bg-indigo-50/30 transition-colors ${
                      selected.has(order.id) ? "bg-indigo-50" : ""
                    }`}>
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggleSelect(order.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    {/* Order ref */}
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md whitespace-nowrap"
                        title={order.id}>
                        {order.orderNumber || `#${String(order.id).slice(0, 8)}`}
                      </span>
                    </td>
                    {/* Customer */}
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                          {order.customer[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800 leading-tight">{order.customer}</div>
                          <div className="text-xs text-slate-400 hidden sm:block leading-tight">{order.phone}</div>
                        </div>
                      </div>
                    </td>
                    {/* Region */}
                    <td className="px-3 py-3.5">
                      <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                        {order.region || "—"}
                      </span>
                    </td>
                    {/* Product */}
                    <td className="px-3 py-3.5 max-w-[180px]">
                      <span className="text-xs text-slate-600 truncate block" title={order.product}>{order.product || "—"}</span>
                    </td>
                    {/* Quantity */}
                    <td className="px-3 py-3.5 text-right text-xs text-slate-700 font-medium whitespace-nowrap">{d.quantity || "—"}</td>
                    {/* Unit price */}
                    <td className="px-3 py-3.5 text-right text-xs text-slate-700 whitespace-nowrap">{money(d.unitUSD, d.unitGHS)}</td>
                    {/* Delivery fee */}
                    <td className="px-3 py-3.5 text-right text-xs text-sky-700 whitespace-nowrap">{money(order.deliveryCostUSD, order.deliveryCostGHS)}</td>
                    {/* Commission ShaQ (5%) */}
                    <td className="px-3 py-3.5 text-right text-xs text-violet-700 whitespace-nowrap">{money(d.commissionUSD, d.commissionGHS)}</td>
                    {/* Status */}
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
                        {order.status}
                      </span>
                    </td>
                    {/* Date (ordered) */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-xs text-slate-600 font-medium">{fmtDate(order.date)}</td>
                    {/* Delivered at */}
                    <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                      {d.deliveredAt
                        ? <span className="text-emerald-600 font-medium">{fmtDate(d.deliveredAt)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setEditOrder(order)} title="Edit order"
                          className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors">
                          <Edit3 size={13} />
                        </button>
                        {canShip && (
                          order.shaqTrackingId ? (
                            <span title={`Sent to ShaQ — tracking ${order.shaqTrackingId}`}
                              className="p-1.5 rounded-lg text-emerald-500">
                              <Truck size={13} />
                            </span>
                          ) : (
                            <button onClick={() => handleShip(order)} disabled={shipOrder.isPending} title="Send to ShaQ"
                              className="p-1.5 rounded-lg hover:bg-sky-100 text-slate-400 hover:text-sky-600 transition-colors disabled:opacity-40">
                              <Send size={13} />
                            </button>
                          )
                        )}
                        <a href={`https://admin.shopify.com/store/orders/${order.shopifyId}`}
                          target="_blank" rel="noopener noreferrer" title="Open in Shopify"
                          className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors">
                          <ExternalLink size={13} />
                        </a>
                        {order.archived ? (
                          <button
                            onClick={() => restoreOrder.mutate(order.id)}
                            title="Unarchive order"
                            className="p-1.5 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors">
                            <ArchiveRestore size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => archiveOrder.mutate(order.id)}
                            title="Archive order"
                            className="p-1.5 rounded-lg hover:bg-amber-100 text-slate-400 hover:text-amber-600 transition-colors">
                            <Archive size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(order)}
                            title="Delete"
                            className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ); })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-700">{Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}</span>
            –
            <span className="font-semibold text-slate-700">{Math.min(currentPage * PAGE_SIZE, filtered.length)}</span>
            {" "}of{" "}
            <span className="font-semibold text-slate-700">{filtered.length}</span> orders
            {" · "}
            <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={currentPage === 1}
              className="px-2 py-1 rounded-lg text-xs hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 font-medium">
              First
            </button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
              <ChevronLeft size={15} />
            </button>
            {pageNumbers().map((n) => (
              <button key={n} onClick={() => setPage(n)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${n === currentPage ? "bg-indigo-600 text-white" : "hover:bg-slate-200 text-slate-600"}`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600">
              <ChevronRight size={15} />
            </button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}
              className="px-2 py-1 rounded-lg text-xs hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 font-medium">
              Last
            </button>
          </div>
        </div>
      </div>

      {editOrder && (
        <OrderEditModal order={editOrder} onSave={handleSaveEdit} onClose={() => setEditOrder(null)} />
      )}
      {showCreate && <OrderCreateModal onClose={() => setShowCreate(false)} />}
      {dialog}
    </div>
  );
}
