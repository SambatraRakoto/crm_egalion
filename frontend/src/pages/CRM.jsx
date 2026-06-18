import { useState } from "react";
import Sidebar from "../components/crm/Sidebar";
import TopBar from "../components/crm/TopBar";
import Dashboard from "./Dashboard";
import Orders from "./Orders";
import Financials from "./Financials";
import Products from "./Products";
import Delivery from "./Delivery";
import Users from "./Users";
import AuditLogs from "./AuditLogs";

export default function CRM() {
  const [activePage, setActivePage] = useState("dashboard");
  const [currency, setCurrency] = useState("GHS");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderPage = () => {
    if (activePage === "dashboard") return <Dashboard currency={currency} />;
    if (activePage === "orders") return <Orders currency={currency} />;
    if (activePage === "products") return <Products currency={currency} />;
    if (activePage === "delivery") return <Delivery />;
    if (activePage === "financials") return <Financials currency={currency} />;
    if (activePage === "users") return <Users />;
    if (activePage === "audit") return <AuditLogs />;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />
      <TopBar
        activePage={activePage}
        currency={currency}
        setCurrency={setCurrency}
        setMobileOpen={setMobileOpen}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <main className={`pt-16 min-h-screen transition-all duration-200 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-56"}`}>
        <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}