import { NavLink, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Users, CreditCard, Settings, ArrowLeft, Shield, FileText, Activity } from "lucide-react";
import { getInitials } from "@/lib/utils";

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/users", icon: Users, label: "Usuários" },
  { to: "/admin/plans", icon: CreditCard, label: "Planos" },
  { to: "/admin/config", icon: Settings, label: "Configurações API" },
  { to: "/admin/audit", icon: Activity, label: "Audit Log" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 bg-red-950 text-white h-screen flex flex-col shrink-0">
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center"><Shield size={18} /></div>
          <div><h1 className="font-semibold text-sm">Admin Panel</h1><p className="text-[10px] text-red-300">Espaço Terapêutico</p></div>
        </div>
        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, exact }) => {
            const isActive = exact ? loc.pathname === to : loc.pathname.startsWith(to);
            return (
              <NavLink key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${isActive ? "bg-red-600/30 text-red-200" : "text-red-300/70 hover:text-white hover:bg-white/5"}`}>
                <Icon size={18} />{label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-2.5 pb-2">
          <NavLink to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-300/70 hover:text-white hover:bg-white/5"><ArrowLeft size={18} />Voltar ao app</NavLink>
        </div>
        <div className="border-t border-white/10 p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600/30 flex items-center justify-center text-red-300 text-xs font-semibold">{getInitials(user?.name || "A")}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{user?.name}</p><p className="text-[10px] text-red-400 truncate">Administrador</p></div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto"><div className="max-w-[1200px] mx-auto p-6 lg:p-8">{children}</div></main>
    </div>
  );
}
