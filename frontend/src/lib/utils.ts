import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useState, useEffect, useCallback } from "react";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
export function formatDate(date: string): string {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
}
export function getInitials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

// ── P1 FIX: Input masks ────────────────────────────────────
export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export function unmask(v: string): string { return v.replace(/\D/g, ""); }

export function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(.)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(d[9]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(d[10]) === check;
}

// ── P1 FIX: Debounce hook ──────────────────────────────────
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ── Status config ──────────────────────────────────────────
export const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  agendado: { label: "Agendado", class: "badge-info" },
  confirmado: { label: "Confirmado", class: "badge-brand" },
  em_andamento: { label: "Em Andamento", class: "badge-warning" },
  concluido: { label: "Concluído", class: "badge-success" },
  cancelado: { label: "Cancelado", class: "badge-danger" },
  ativo: { label: "Ativo", class: "badge-success" },
  inativo: { label: "Inativo", class: "badge-neutral" },
  pendente: { label: "Pendente", class: "badge-warning" },
  pago: { label: "Pago", class: "badge-success" },
  parcial: { label: "Parcial", class: "badge-info" },
};
