import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog, MaskedInput } from "@/components/common";
import { usePatients } from "@/hooks/useData";
import { Users, Phone, Edit, Trash2, Plus, MessageCircle, FileText } from "lucide-react";
import { patientsApi } from "@/lib/api";
import { useDebounce } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function initials(name: string | undefined | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map(n => n[0] || "").join("").toUpperCase() || "?";
}

function fmtPhone(v: string | undefined | null): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Pacientes() {
  const { data: patients, isLoading, refetch } = usePatients();
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf: "", birthDate: "", address: "", notes: "", status: "ativo" });
  const nav = useNavigate();

  const safePatients = Array.isArray(patients) ? patients : [];

  const filtered = safePatients.filter((p: any) => {
    if (!p) return false;
    const matchSearch = (p.name || "").toLowerCase().includes(dSearch.toLowerCase()) || (p.email || "").toLowerCase().includes(dSearch.toLowerCase()) || (p.cpf || "").includes(dSearch);
    const matchFilter = filter === 'todos' || p.status === filter;
    return matchSearch && matchFilter;
  });

  const openNew = () => { setEditing(null); setForm({ name: "", email: "", phone: "", cpf: "", birthDate: "", address: "", notes: "", status: "ativo" }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await patientsApi.update(editing.id, form);
      else await patientsApi.create(form);
      toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado!");
      setShowForm(false); refetch();
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleDelete = async () => {
    if (deleteTarget) { await patientsApi.delete(deleteTarget); toast.success("Paciente removido"); setDeleteTarget(null); refetch(); }
  };

  if (isLoading) return <MainLayout><PageHeader title="Pacientes" /><TableSkeleton /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Meus Pacientes" subtitle={`${safePatients.length} pacientes`} action={{ label: "Novo Paciente", onClick: openNew }} />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, CPF ou email" className="flex-1" />
        <div className="flex gap-1 bg-surface-50 dark:bg-surface-850 rounded-xl p-1">
          {(['ativo', 'inativo', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white dark:bg-surface-700 shadow-sm' : 'text-surface-500'}`}>
              {f === 'ativo' ? 'Ativos' : f === 'inativo' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum paciente" description="Cadastre seu primeiro paciente" action={{ label: "Novo Paciente", onClick: openNew }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 page-enter">
          {filtered.map((p: any) => (
            <div key={p.id} className="glass-card p-4 hover:shadow-elevated transition-all cursor-pointer group" onClick={() => nav(`/pacientes/${p.id}`)}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center text-brand-600 dark:text-brand-300 text-sm font-bold shrink-0">
                  {initials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{p.name || "Sem nome"}</h3>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${p.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-surface-100 text-surface-500'}`}>
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 truncate mt-0.5">{p.email || "Email não informado"}</p>
                  {p.phone && <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1"><Phone size={9} /> {fmtPhone(p.phone)}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                {p.phone && (
                  <a href={`https://wa.me/55${(p.phone || "").replace(/\D/g, '')}`} target="_blank" rel="noopener"
                    onClick={e => e.stopPropagation()} className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="WhatsApp">
                    <MessageCircle size={13} />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); nav(`/pacientes/${p.id}`); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10" title="Prontuário"><FileText size={13} /></button>
                <button onClick={e => { e.stopPropagation(); setEditing(p); setForm({ name: p.name || "", email: p.email || "", phone: p.phone || "", cpf: p.cpf || "", birthDate: p.birthDate || "", address: p.address || "", notes: p.notes || "", status: p.status || "ativo" }); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10" title="Editar"><Edit size={13} /></button>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(p.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title="Remover"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Remover paciente" description="Todos os dados serão removidos." confirmLabel="Remover" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Paciente" : "Novo Paciente"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome completo *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-premium w-full" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-premium w-full" /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Telefone</label>
              <MaskedInput mask="phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} className="input-premium w-full" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">CPF</label>
              <MaskedInput mask="cpf" value={form.cpf} onChange={v => setForm(f => ({ ...f, cpf: v }))} className="input-premium w-full" /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nascimento</label>
              <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="input-premium w-full" /></div>
          </div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Endereço</label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-premium w-full" /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Observações</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Salvar" : "Cadastrar"}</button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
}
