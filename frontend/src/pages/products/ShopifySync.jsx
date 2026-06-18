import { useState } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff, Clock, Package, ShoppingCart, ChevronDown, ChevronUp, Link2, Webhook, Save, Loader2 } from "lucide-react";
import { useSyncHistory, useTriggerSync, useShopifySettings, useUpdateShopifySettings, useCheckConnection, useRegisterWebhooks } from "@/hooks/useShopify";
import { useProducts } from "@/hooks/useProducts";
import { useOrders } from "@/hooks/useOrders";
import { LoadingState } from "@/components/feedback/LoadingState";

const STATUS_ICON = {
  success: <CheckCircle size={14} className="text-emerald-500" />,
  error: <XCircle size={14} className="text-rose-500" />,
  warning: <AlertTriangle size={14} className="text-amber-500" />,
};
const STATUS_ROW = {
  success: "bg-emerald-50 text-emerald-700",
  error: "bg-rose-50 text-rose-700",
  warning: "bg-amber-50 text-amber-700",
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ShopifySync() {
  const [expanded, setExpanded] = useState(null);

  const { data: history = [], isLoading } = useSyncHistory();
  const { data: settings } = useShopifySettings();
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrders();
  const triggerSync = useTriggerSync();
  const updateSettings = useUpdateShopifySettings();
  const checkConnection = useCheckConnection();
  const registerWebhooks = useRegisterWebhooks();

  const [form, setForm] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  // Hydrate the form from settings once loaded.
  const formState = form ?? { storeDomain: settings?.storeDomain || "", accessToken: "", apiVersion: settings?.apiVersion || "2024-10" };
  const setField = (k, v) => setForm({ ...formState, [k]: v });

  const syncingKind = triggerSync.isPending ? triggerSync.variables : null;
  const syncing = triggerSync.isPending;
  const connected = checkConnection.data ? checkConnection.data.connected : settings?.connected;

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavedMsg("");
    const payload = { storeDomain: formState.storeDomain, apiVersion: formState.apiVersion };
    if (formState.accessToken) payload.accessToken = formState.accessToken;
    try {
      await updateSettings.mutateAsync(payload);
      setSavedMsg("Settings saved");
      setForm({ ...formState, accessToken: "" });
    } catch (err) {
      setSavedMsg(err?.message || "Failed to save settings");
    }
  };

  if (isLoading && !history.length) return <LoadingState label="Loading sync status…" />;

  const last = history[0] || { date: new Date().toISOString(), duration: "—" };
  const successCount = history.filter((s) => s.status === "success").length;

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${connected ? "bg-emerald-50" : "bg-slate-100"}`}>
              {connected ? <Wifi size={26} className="text-emerald-500" /> : <WifiOff size={26} className="text-slate-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{connected ? "Shopify connected" : "Shopify"}</h2>
                <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${connected ? "text-emerald-600 bg-emerald-100" : "text-slate-500 bg-slate-100"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} /> {connected ? "Live" : "Offline"}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">Store: <span className="font-medium text-slate-600">{settings?.storeDomain || "—"}</span></p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Clock size={11} /> Last sync: <span className="font-medium text-slate-600">{formatDate(last.date)}</span>
              </p>
              {checkConnection.data?.shop?.name && (
                <p className="text-xs text-emerald-600 mt-1">✓ {checkConnection.data.shop.name}</p>
              )}
              {checkConnection.isError && <p className="text-xs text-rose-600 mt-1">Connexion échouée</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => checkConnection.mutate()} disabled={checkConnection.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {checkConnection.isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Test
            </button>
            <button onClick={() => registerWebhooks.mutate()} disabled={registerWebhooks.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {registerWebhooks.isPending ? <Loader2 size={15} className="animate-spin" /> : <Webhook size={15} />} Webhooks
            </button>
            <button onClick={() => triggerSync.mutate("products")} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {syncingKind === "products" ? <RefreshCw size={15} className="animate-spin" /> : <Package size={15} />} Sync products
            </button>
            <button onClick={() => triggerSync.mutate("orders")} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
              {syncingKind === "orders" ? <RefreshCw size={15} className="animate-spin" /> : <ShoppingCart size={15} />} Sync orders
            </button>
          </div>
        </div>

        {registerWebhooks.isSuccess && (
          <p className="mt-3 text-xs text-emerald-600">✓ {registerWebhooks.data?.length || 0} webhook(s) processed</p>
        )}

        {syncing && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Syncing {syncingKind === "orders" ? "orders" : "products"}…</span>
              <span className="text-indigo-600 font-medium">En cours</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Connection settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Store domain</label>
            <input value={formState.storeDomain} onChange={(e) => setField("storeDomain", e.target.value)}
              placeholder="ma-boutique.myshopify.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Access token</label>
            <input type="password" value={formState.accessToken} onChange={(e) => setField("accessToken", e.target.value)}
              placeholder={settings?.hasToken ? "•••••••• (unchanged)" : "shpat_…"}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">API version</label>
            <input value={formState.apiVersion} onChange={(e) => setField("apiVersion", e.target.value)}
              placeholder="2024-10"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="submit" disabled={updateSettings.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50">
            {updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
          {savedMsg && <span className="text-xs text-slate-500">{savedMsg}</span>}
        </div>
      </form>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Synced Products", value: products.length, icon: Package, color: "text-indigo-600 bg-indigo-50" },
          { label: "Synced Orders", value: orders.length, icon: ShoppingCart, color: "text-emerald-600 bg-emerald-50" },
          { label: "Last Sync Duration", value: last.duration, icon: Clock, color: "text-amber-600 bg-amber-50" },
          { label: "Successful Syncs", value: `${successCount}/${history.length || 0}`, icon: CheckCircle, color: "text-violet-600 bg-violet-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color.split(" ")[1]}`}>
              <s.icon size={18} className={s.color.split(" ")[0]} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              <p className="text-lg font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Synchronization History</h3>
          <p className="text-xs text-slate-400">Last 7 sync operations</p>
        </div>
        <div className="divide-y divide-slate-50">
          {history.map((entry) => (
            <div key={entry.id}>
              <div
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 cursor-pointer transition-colors"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${STATUS_ROW[entry.status]}`}>
                  {STATUS_ICON[entry.status]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_ROW[entry.status]}`}>
                      {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(entry.date)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                  {entry.status !== "error" && (
                    <>
                      <span className="hidden sm:block"><span className="font-semibold text-slate-700">{entry.products}</span> products</span>
                      <span className="hidden sm:block"><span className="font-semibold text-slate-700">{entry.orders}</span> orders</span>
                    </>
                  )}
                  <span className="font-mono">{entry.duration}</span>
                  {expanded === entry.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {expanded === entry.id && (
                <div className="px-5 pb-4 bg-slate-50/40">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                    {[
                      { label: "Status", value: entry.status },
                      { label: "Products Synced", value: entry.products },
                      { label: "Orders Synced", value: entry.orders },
                      { label: "Duration", value: entry.duration },
                    ].map((d) => (
                      <div key={d.label} className="bg-white rounded-xl p-3 border border-slate-100">
                        <p className="text-xs text-slate-400">{d.label}</p>
                        <p className="text-sm font-semibold text-slate-700 mt-0.5 capitalize">{d.value}</p>
                      </div>
                    ))}
                  </div>
                  {entry.note && (
                    <p className="text-xs text-slate-500 mt-2 bg-white rounded-xl px-3 py-2 border border-slate-100">
                      <span className="font-semibold text-slate-600">Note:</span> {entry.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Config Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Sync Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Sync Frequency", value: "Every 24 hours" },
            { label: "API Version", value: "Shopify Admin 2024-10" },
            { label: "Webhook Status", value: "Active" },
            { label: "Products Endpoint", value: "/admin/api/products.json" },
            { label: "Orders Endpoint", value: "/admin/api/orders.json" },
            { label: "Data Direction", value: "Shopify → CRM (read-only)" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-xs text-slate-400 font-medium">{c.label}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}