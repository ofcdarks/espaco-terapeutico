import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, StatCard, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog } from "@/components/common";
import { useTransactions, usePackages, useDashboard } from "@/hooks/useData";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, Edit, Trash2, Package } from "lucide-react";
import { formatCurrency, formatDate, STATUS_CONFIG, useDebounce } from "@/lib/utils";
import type { Transaction } from "@/types";
const CATS: Record<string,string> = { consulta:"Consulta",pacote:"Pacote",produto:"Produto",outros_receita:"Outros",aluguel:"Aluguel",salario:"Salário",material:"Material",marketing:"Marketing",software:"Software",outros_despesa:"Outros" };
export default function Financeiro() {
  const { data: transactions, loading, create, update, remove } = useTransactions();
  const { data: packages } = usePackages();
  const { stats } = useDashboard();
  const [tab, setTab] = useState("transacoes");
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "receita" as string, category: "consulta", description: "", value: 0, date: new Date().toISOString().split("T")[0], paymentMethod: "pix", status: "pendente" });
  const s = stats || { monthRevenue: 0, monthExpenses: 0, pendingPayments: 0 };
  const filtered = transactions.filter(t => t.description?.toLowerCase().includes(dSearch.toLowerCase()) || t.patientName?.toLowerCase().includes(dSearch.toLowerCase()));
  const openNew = (type: "receita" | "despesa") => { setEditing(null); setForm({ type, category: type === "receita" ? "consulta" : "aluguel", description: "", value: 0, date: new Date().toISOString().split("T")[0], paymentMethod: "pix", status: "pendente" }); setShowForm(true); };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); if (editing) await update({ id: editing.id, ...form, value: Number(form.value) } as any); else await create({ ...form, value: Number(form.value) } as any); setShowForm(false); };
  if (loading) return <MainLayout><PageHeader title="Financeiro" /><TableSkeleton /></MainLayout>;
  return (
    <MainLayout>
      <PageHeader title="Financeiro" subtitle="Controle de receitas e despesas" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 page-enter" role="group" aria-label="Resumo financeiro">
        <StatCard icon={TrendingUp} label="Receita do Mês" value={formatCurrency(s.monthRevenue)} color="emerald" />
        <StatCard icon={TrendingDown} label="Despesas do Mês" value={formatCurrency(s.monthExpenses)} color="red" />
        <StatCard icon={DollarSign} label="Pagamentos Pendentes" value={formatCurrency(s.pendingPayments)} color="amber" />
      </div>
      <div className="flex items-center gap-6 border-b border-surface-200 dark:border-surface-800 mb-6" role="tablist">
        {[{id:"transacoes",l:"Transações"},{id:"pacotes",l:"Pacotes"}].map(t => (
          <button key={t.id} role="tab" aria-selected={tab===t.id} onClick={() => setTab(t.id)}
            className={`pb-3 text-sm font-medium transition-all border-b-2 ${tab===t.id ? "text-brand-600 border-brand-600" : "text-surface-500 border-transparent hover:text-foreground"}`}>{t.l}</button>
        ))}
        <div className="flex-1" />
        {tab === "transacoes" && <div className="flex gap-2 pb-3">
          <button onClick={() => openNew("receita")} className="btn-primary flex items-center gap-1.5 h-8 text-xs"><ArrowUpCircle size={14} aria-hidden="true" /><span className="hidden sm:inline">Receita</span></button>
          <button onClick={() => openNew("despesa")} className="btn-secondary flex items-center gap-1.5 h-8 text-xs"><ArrowDownCircle size={14} aria-hidden="true" /><span className="hidden sm:inline">Despesa</span></button>
        </div>}
      </div>
      {tab === "transacoes" && (<>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar transação..." />
        <div className="glass-card overflow-x-auto mt-4 page-enter">
          <table className="table-premium" role="table" aria-label="Transações">
            <thead><tr><th scope="col">Descrição</th><th scope="col" className="hidden sm:table-cell">Categoria</th><th scope="col" className="hidden sm:table-cell">Data</th><th scope="col">Status</th><th scope="col" className="text-right">Valor</th><th scope="col" className="w-10"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{filtered.map(t => (
              <tr key={t.id}>
                <td><div className="flex items-center gap-2">{t.type==="receita"?<ArrowUpCircle size={14} className="text-emerald-500 shrink-0" aria-hidden="true"/>:<ArrowDownCircle size={14} className="text-red-500 shrink-0" aria-hidden="true"/>}<span className="text-sm truncate">{t.description||"—"}</span></div></td>
                <td className="text-xs hidden sm:table-cell">{CATS[t.category]||t.category}</td>
                <td className="text-xs hidden sm:table-cell">{formatDate(t.date)}</td>
                <td><span className={`badge ${STATUS_CONFIG[t.status]?.class}`}>{STATUS_CONFIG[t.status]?.label}</span></td>
                <td className={`text-right font-medium text-sm ${t.type==="receita"?"text-emerald-600 dark:text-emerald-400":"text-red-600 dark:text-red-400"}`}>{t.type==="receita"?"+":"-"}{formatCurrency(t.value)}</td>
                <td><div className="flex gap-1">
                  <button onClick={() => { setEditing(t); setForm({ type:t.type, category:t.category, description:t.description, value:t.value, date:t.date, paymentMethod:t.paymentMethod||"pix", status:t.status }); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" aria-label="Editar"><Edit size={14}/></button>
                  <button onClick={() => setDeleteTarget(t.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all" aria-label="Remover"><Trash2 size={14}/></button>
                </div></td>
              </tr>))}</tbody>
          </table>
          {filtered.length===0 && <div className="py-12 text-center text-sm text-surface-500">Nenhuma transação encontrada</div>}
        </div></>)}
      {tab === "pacotes" && (<div className="grid grid-cols-1 md:grid-cols-3 gap-4 page-enter">{packages.map(p => (
        <div key={p.id} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3"><Package size={18} className="text-brand-600" aria-hidden="true"/>{p.isActive?<span className="badge badge-success">Ativo</span>:<span className="badge badge-neutral">Inativo</span>}</div>
          <h3 className="font-semibold">{p.name}</h3><p className="text-sm text-surface-500 mt-1">{p.sessions} sessões · {p.validity} dias</p>
          <p className="text-lg font-semibold text-brand-600 dark:text-brand-300 mt-2">{formatCurrency(p.value)}</p>
        </div>))}</div>)}
      <ConfirmDialog open={!!deleteTarget} title="Remover transação" description="Deseja remover esta transação?" confirmLabel="Remover"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />
      <Modal open={showForm} onClose={() => setShowForm(false)} title={`${editing?"Editar":"Nova"} ${form.type==="receita"?"Receita":"Despesa"}`} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="tx-desc" className="text-xs font-medium text-surface-500 mb-1 block">Descrição</label><input id="tx-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-premium w-full" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="tx-val" className="text-xs font-medium text-surface-500 mb-1 block">Valor *</label><input id="tx-val" type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: +e.target.value }))} className="input-premium w-full" required /></div>
            <div><label htmlFor="tx-date" className="text-xs font-medium text-surface-500 mb-1 block">Data</label><input id="tx-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-premium w-full" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="tx-status" className="text-xs font-medium text-surface-500 mb-1 block">Status</label><select id="tx-status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-premium w-full"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="parcial">Parcial</option></select></div>
            <div><label htmlFor="tx-method" className="text-xs font-medium text-surface-500 mb-1 block">Método</label><select id="tx-method" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input-premium w-full"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão Crédito</option><option value="cartao_debito">Cartão Débito</option><option value="transferencia">Transferência</option></select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing?"Salvar":"Criar"}</button></div>
        </form>
      </Modal>
    </MainLayout>);
}
