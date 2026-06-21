import { useState } from "react";
import { Menu, Bell, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useConfirm } from "@/hooks/useConfirm";
import ChangePasswordModal from "@/components/ChangePasswordModal";

const PAGE_TITLES = {
  dashboard: "Analytics Dashboard",
  orders: "Order Management",
  products: "Product Management",
  financials: "Financial Dashboard",
  delivery: "Delivered Orders",
  users: "User Management",
  audit: "Audit Log",
};

export default function TopBar({ activePage, currency, setCurrency, setMobileOpen, sidebarCollapsed }) {
  const leftOffset = sidebarCollapsed ? "lg:left-16" : "lg:left-56";
  const { logout } = useAuth();
  const { confirm, dialog } = useConfirm();
  const [showChangePassword, setShowChangePassword] = useState(false);

  // FR : Demande confirmation avant de déconnecter l'utilisateur.
  // EN : Ask for confirmation before logging the user out.
  const handleLogout = async () => {
    const ok = await confirm({
      title: "Log out",
      message: "Are you sure you want to log out?",
      confirmLabel: "Log out",
      variant: "danger",
    });
    if (ok) logout();
  };

  return (
    <header className={`h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 fixed top-0 left-0 ${leftOffset} right-0 z-20 shadow-sm transition-all duration-200`}>
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-slate-900 font-semibold text-base leading-tight">{PAGE_TITLES[activePage]}</h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setCurrency("GHS")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currency === "GHS" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            GHS
          </button>
          <button
            onClick={() => setCurrency("USD")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currency === "USD" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            USD
          </button>
        </div>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>
        <button
          onClick={() => setShowChangePassword(true)}
          title="Change password"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <KeyRound size={18} />
        </button>
        <button
          onClick={handleLogout}
          title="Log out"
          className="p-2 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {dialog}
    </header>
  );
}