import { LayoutDashboard, ShoppingCart, DollarSign, Package, Truck, Users as UsersIcon, Shield, X, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const NAV_ITEMS = [
  { id: "dashboard", label: "Analytics", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "products", label: "Products", icon: Package },
  { id: "delivery", label: "Delivered", icon: Truck },
  { id: "financials", label: "Financials", icon: DollarSign, roles: ["admin", "super_admin", "manager", "finance"] },
  { id: "users", label: "Users", icon: UsersIcon, roles: ["admin", "super_admin"] },
  { id: "audit", label: "Audit Log", icon: Shield, roles: ["admin", "super_admin"] },
];

function initialsOf(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Sidebar({ activePage, setActivePage, mobileOpen, setMobileOpen, collapsed, setCollapsed }) {
  const { user, hasRole } = useAuth();
  const displayName = user?.fullName || "User";
  const initials = initialsOf(user?.fullName);
  const roleLabel = user?.roles?.[0] ? user.roles[0].replace(/_/g, " ") : "Member";
  const visibleNav = NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => hasRole(r)));
  const NavLink = ({ item }) => {
    const Icon = item.icon;
    const isActive = activePage === item.id;
    return (
      <button
        onClick={() => { setActivePage(item.id); setMobileOpen(false); }}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${
          collapsed ? "justify-center px-2 py-3" : "px-4 py-3"
        } ${
          isActive
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/30"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />}
      </button>
    );
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full relative">
      {/* Logo */}
      <div className={`flex items-center border-b border-slate-800 transition-all duration-200 ${collapsed && !isMobile ? "justify-center px-2 py-5" : "gap-3 px-4 py-5"}`}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <TrendingUp size={16} className="text-white" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <div className="text-white font-bold text-sm leading-tight">nuruyaCRM</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 space-y-1 ${collapsed && !isMobile ? "px-2" : "px-3"}`}>
        {!collapsed && !isMobile && (
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-4 mb-3">Menu</p>
        )}
        {visibleNav.map((item) => <NavLink key={item.id} item={item} />)}
      </nav>

      {/* Footer / Avatar */}
      <div className={`border-t border-slate-800 ${collapsed && !isMobile ? "px-2 py-4 flex justify-center" : "px-4 py-4"}`}>
        {collapsed && !isMobile ? (
          <div title={`${displayName} — ${roleLabel}`} className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold cursor-default">
            {initials}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initials}</div>
            <div className="overflow-hidden">
              <div className="text-white text-xs font-medium truncate">{displayName}</div>
              <div className="text-slate-500 text-xs truncate capitalize">{roleLabel}</div>
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle button (desktop only) */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[72px] w-6 h-6 bg-slate-700 hover:bg-indigo-600 border border-slate-600 rounded-full flex items-center justify-center text-white shadow-md transition-colors z-10"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-slate-900 fixed top-0 left-0 h-full z-30 transition-all duration-200 ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-900 h-full z-50 flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <SidebarContent isMobile />
          </aside>
        </div>
      )}
    </>
  );
}