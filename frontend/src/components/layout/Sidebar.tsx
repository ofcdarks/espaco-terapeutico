import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Calendar, Users, FileText, DollarSign,
  FileCheck, FileSignature, BarChart3, Link2, CalendarClock, MessageSquare, Mail, Settings, LogOut, Video,
  ChevronLeft, Menu, X, Bell, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { notificationsApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/pacientes", icon: Users, label: "Pacientes" },
  { to: "/prontuarios", icon: FileText, label: "Prontuários" },
  { to: "/financeiro", icon: DollarSign, label: "Financeiro" },
  { to: "/documentos", icon: FileCheck, label: "Documentos" },
  { to: "/contratos", icon: FileSignature, label: "Contratos" },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios" },
  { to: "/links-cadastro", icon: Link2, label: "Links Cadastro" },
  { to: "/agenda-publica", icon: CalendarClock, label: "Agenda Online" },
  { to: "/mensagens", icon: MessageSquare, label: "Mensagens" },
  { to: "/emails", icon: Mail, label: "E-mails" },
];

const BOTTOM_NAV = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/agenda", icon: Calendar, label: "Agenda" },
  { to: "/pacientes", icon: Users, label: "Pacientes" },
  { to: "/financeiro", icon: DollarSign, label: "Financeiro" },
  { to: "/configuracoes", icon: Settings, label: "Config" },
];

function NavItem({ to, icon: Icon, label, collapsed, onClick }: {
  to: string; icon: any; label: string; collapsed: boolean; onClick?: () => void;
}) {
  const loc = useLocation();
  const isActive = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
  return (
    <NavLink to={to} onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative ${
        isActive ? "bg-brand-200/30 text-brand-200" : "text-surface-400 hover:text-white hover:bg-white/5"
      } ${collapsed ? "justify-center px-0" : ""}`}
      aria-current={isActive ? "page" : undefined}>
      {isActive && (
        <motion.div layoutId="sidebar-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full"
          transition={{ type: "spring", stiffness: 350, damping: 30 }} />
      )}
      <Icon size={19} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

function NotificationBell() {
  const { data } = useQuery({ queryKey: ["notif-count"], queryFn: () => notificationsApi.unreadCount(), refetchInterval: 60000 });
  const count = data?.count || 0;
  const [open, setOpen] = useState(false);
  const { data: notifs } = useQuery({ queryKey: ["notifs"], queryFn: () => notificationsApi.list(10, true), enabled: open });

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 relative"
        aria-label={`Notificações${count > 0 ? ` (${count} novas)` : ""}`}>
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 w-72 glass-card p-3 z-50 shadow-elevated max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Notificações</p>
              {count > 0 && (
                <button onClick={async () => { await notificationsApi.markAllRead(); setOpen(false); }}
                  className="text-[10px] text-brand-600 dark:text-brand-300">Marcar todas como lidas</button>
              )}
            </div>
            {(!notifs || notifs.length === 0)
              ? <p className="text-xs text-surface-500 py-4 text-center">Nenhuma notificação</p>
              : notifs.map((n: any) => (
                <div key={n.id} className="p-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/30 cursor-pointer mb-1"
                  onClick={async () => { await notificationsApi.markRead(n.id); }}>
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-[10px] text-surface-500">{n.body}</p>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  );
}

// ── Desktop Sidebar ─────────────────────────────────────────
export function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = (user as any)?.isAdmin;

  return (
    <aside className="glass-sidebar h-screen hidden lg:flex flex-col transition-all duration-300 shrink-0"
      style={{ width: collapsed ? 72 : 260 }} role="navigation" aria-label="Menu principal">
      <div className={`flex items-center h-16 px-4 border-b border-white/5 ${collapsed ? "justify-center" : "gap-3"}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm" aria-hidden="true">ET</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-semibold text-sm text-white leading-tight">Espaço</h1>
            <p className="text-[11px] text-surface-400 leading-tight">Terapêutico</p>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className={`${collapsed ? "hidden" : "ml-auto"} w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-white hover:bg-white/10 transition-all`}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
          <ChevronLeft size={16} />
        </button>
      </div>
      {collapsed && (
        <button onClick={() => setCollapsed(false)}
          className="w-full flex justify-center py-3 text-surface-400 hover:text-white transition-colors"
          aria-label="Expandir menu">
          <Menu size={18} />
        </button>
      )}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto" aria-label="Navegação">
        {NAV.map(n => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
        <NavLink to="/teleconsulta"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-emerald-400 hover:bg-emerald-500/10 ${collapsed ? "justify-center px-0" : ""}`}>
          <Video size={19} className="shrink-0" aria-hidden="true" />
          {!collapsed && <span>Teleconsulta</span>}
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-amber-400 hover:bg-amber-500/10 ${collapsed ? "justify-center px-0" : ""}`}>
            <Shield size={19} className="shrink-0" aria-hidden="true" />
            {!collapsed && <span>Admin</span>}
          </NavLink>
        )}
      </nav>
      <div className="px-2.5 pb-2">
        <NavItem to="/configuracoes" icon={Settings} label="Configurações" collapsed={collapsed} />
      </div>
      <div className={`border-t border-white/5 p-3 flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
        <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-200 text-xs font-semibold shrink-0" aria-hidden="true">
          {getInitials(user?.name || "U")}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-surface-500 truncate">{user?.email}</p>
          </div>
        )}
        {!collapsed && (
          <button onClick={logout}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            aria-label="Sair">
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Mobile Header + Drawer ──────────────────────────────────
export function MobileHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAdmin = (user as any)?.isAdmin;

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <>
      <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-surface-200 dark:border-surface-800 bg-background sticky top-0 z-40">
        <button onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
          aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
            <span className="text-white font-bold text-[10px]">ET</span>
          </div>
          <span className="font-semibold text-sm">Espaço Terapêutico</span>
        </div>
        <NotificationBell />
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 lg:hidden" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] glass-sidebar z-50 flex flex-col lg:hidden"
              role="dialog" aria-modal="true" aria-label="Menu de navegação">
              <div className="flex items-center justify-between h-14 px-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
                    <span className="text-white font-bold text-xs">ET</span>
                  </div>
                  <span className="font-semibold text-sm text-white">Espaço Terapêutico</span>
                </div>
                <button onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-white"
                  aria-label="Fechar menu">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto" aria-label="Navegação">
                {NAV.map(n => <NavItem key={n.to} {...n} collapsed={false} onClick={() => setOpen(false)} />)}
                <NavLink to="/teleconsulta" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-emerald-400 hover:bg-emerald-500/10">
                  <Video size={19} aria-hidden="true" /><span>Teleconsulta</span>
                </NavLink>
                {isAdmin && (
                  <NavLink to="/admin" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-amber-400 hover:bg-amber-500/10">
                    <Shield size={19} aria-hidden="true" /><span>Admin</span>
                  </NavLink>
                )}
              </nav>
              <div className="px-2.5 pb-2">
                <NavItem to="/configuracoes" icon={Settings} label="Configurações" collapsed={false} onClick={() => setOpen(false)} />
              </div>
              <div className="border-t border-white/5 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-200 text-xs font-semibold">
                  {getInitials(user?.name || "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                </div>
                <button onClick={logout}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-red-500/10"
                  aria-label="Sair">
                  <LogOut size={16} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-surface-200 dark:border-surface-800 flex items-center justify-around h-14 safe-bottom"
        aria-label="Navegação rápida">
        {BOTTOM_NAV.map(({ to, icon: Icon, label }) => {
          const loc = useLocation();
          const isActive = to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to}
              className={`flex flex-col items-center gap-0.5 text-[10px] px-3 py-1 rounded-lg transition-colors ${isActive ? "text-brand-600 dark:text-brand-300" : "text-surface-400"}`}
              aria-label={label}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
