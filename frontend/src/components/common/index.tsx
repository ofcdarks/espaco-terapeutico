import { ReactNode, Component, useState, useEffect, useRef, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Search, AlertTriangle, X } from "lucide-react";

// ── P1 FIX: Error Boundary ─────────────────────────────────
interface EBState { hasError: boolean; error?: Error }
export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-4" />
          <h2 className="text-lg font-semibold mb-1">Algo deu errado</h2>
          <p className="text-sm text-surface-500 mb-4 max-w-sm">{this.state.error?.message || "Erro inesperado"}</p>
          <button onClick={() => this.setState({ hasError: false })} className="btn-primary">Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Protected Route ─────────────────────────────────────────
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-600" aria-label="Carregando" /></div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

// ── Page Header ─────────────────────────────────────────────
export function PageHeader({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: { label: string; onClick: () => void }; children?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8 page-enter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-surface-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
        {action && (
          <button onClick={action.onClick} className="btn-primary flex items-center gap-2" aria-label={action.label}>
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">{action.label}</span>
            <span className="sm:hidden">Novo</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Search with debounce ────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = "Buscar..." }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" aria-hidden="true" />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="input-premium pl-9 w-full sm:w-64" aria-label={placeholder} role="searchbox" />
    </div>
  );
}

// ── P1 FIX: Confirm Dialog (replaces window.confirm) ────────
export function ConfirmDialog({ open, onConfirm, onCancel, title, description, confirmLabel = "Confirmar", variant = "danger" }: {
  open: boolean; onConfirm: () => void; onCancel: () => void;
  title: string; description: string; confirmLabel?: string; variant?: "danger" | "default";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}
      role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
      <div className="glass-card w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-semibold mb-2">{title}</h2>
        <p id="confirm-desc" className="text-sm text-surface-500 mb-5">{description}</p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} onClick={onCancel} className="btn-secondary">Cancelar</button>
          <button onClick={onConfirm} className={variant === "danger" ? "btn-primary !bg-red-600 hover:!bg-red-700" : "btn-primary"}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── P2 FIX: Skeleton loaders ────────────────────────────────
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-200 dark:bg-surface-700 rounded-lg ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card overflow-hidden" aria-busy="true" aria-label="Carregando dados">
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }: {
  icon: any; title: string; description: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
        <Icon size={24} className="text-surface-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-surface-500 max-w-sm mb-4">{description}</p>
      {action && <button onClick={action.onClick} className="btn-primary flex items-center gap-2"><Plus size={16} aria-hidden="true" /> {action.label}</button>}
    </div>
  );
}

export function LoadingState() {
  return <div className="flex items-center justify-center py-20" role="status" aria-label="Carregando"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
}

// ── Stat Card ───────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, trend, color = "brand" }: {
  label: string; value: string | number; icon: any; trend?: string; color?: "brand" | "emerald" | "amber" | "red";
}) {
  const colors = {
    brand: "bg-brand-100 dark:bg-brand-600/10 text-brand-600 dark:text-brand-300",
    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <div className="stat-card" role="group" aria-label={label}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`} aria-hidden="true"><Icon size={20} /></div>
        {trend && <span className="text-xs font-medium text-emerald-500">{trend}</span>}
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
    </div>
  );
}

// ── Modal wrapper (accessible) ──────────────────────────────
export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={`glass-card w-full ${sizes[size]} p-6 animate-slide-up max-h-[85vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-foreground hover:bg-surface-100 dark:hover:bg-surface-800 transition-all"
            aria-label="Fechar"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Masked Input ────────────────────────────────────────────
export function MaskedInput({ value, onChange, mask, ...props }: {
  value: string; onChange: (v: string) => void; mask: (v: string) => string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return <input {...props} value={mask(value)} onChange={e => onChange(e.target.value.replace(/\D/g, ""))} className={`input-premium ${props.className || ""}`} />;
}
