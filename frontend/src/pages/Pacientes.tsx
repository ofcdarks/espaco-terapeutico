import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog, MaskedInput } from "@/components/common";
import { usePatients } from "@/hooks/useData";
import { Users, Phone, Mail, Edit, Trash2, ExternalLink, Upload, Download, Link2, Plus, MessageCircle, FileText, Clock, UserPlus } from "lucide-react";
import { patientsApi, csvApi, portalApi } from "@/lib/api";
import { useDebounce, getInitials, maskCpf, maskPhone } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Pacientes() {
  const { data: patients, isLoading, refetch } = usePatients();
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ativo' | 'inativo' | 'todos'>('ativo');
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf: "", birthDate: "", address: "", notes: "", status: "ativo" });
  const nav = useNavigate();
  const API = import.meta.env.VITE_API_URL || "";
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("accessToken")}`, "Content-Type": "application/json" });

  const filtered = (patients || []).filter((p: any) => {
    const matchSearch = p.name?.toLowerCase().includes(dSearch.toLowerCase()) || p.email?.toLowerCase().includes(dSearch.toLowerCase()) || p.cpf?.includes(dSearch);
    const matchFilter = filter === 'todos' || p.status === filter;
    return matchSearch && matchFilter;
  });

  const openNew = () => { setEditing(null); setForm({ name: "", email: "", phone: "", cpf: "", birthDate: "", address: "", notes: "", status: "ativo" }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await patientsApi.update(editing.id, form);
    else await patientsApi.create(form);
    toast.success(editing ? "Paciente atualizado" : "Paciente cadastrado!");
    setShowForm(false); refetch();
  };

  const handleDelete = async () => {
    if (deleteTarget) { await patientsApi.delete(deleteTarget); toast.success("Paciente removido"); setDeleteTarget(null); refetch(); }
  };

  const exportCsv = () => { window.open(csvApi.exportUrl, '_blank'); };

  if (isLoading) return <MainLayout><PageHeader title="Pacientes" /><TableSkeleton /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Meus Pacientes" subtitle={`Gerencie seus pacientes (${patients?.length || 0} pacientes)`}
        action={{ label: "Novo Paciente", onClick: openNew }}>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="btn-ghost h-8 text-xs flex items-center gap-1.5"><Download size={12} /> Exportar</button>
        </div>
      </PageHeader>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar paciente por nome, CPF ou email" className="flex-1" />
        <div className="flex gap-1 bg-surface-50 dark:bg-surface-850 rounded-xl p-1">
          {(['ativo', 'inativo', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white dark:bg-surface-700 shadow-sm' : 'text-surface-500 hover:text-foreground'}`}>
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
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${p.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-surface-100 text-surface-500'}`}>
                      {p.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 truncate mt-0.5">{p.email || "Email não informado"}</p>
                  {p.phone && <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1"><Phone size={9} /> {maskPhone(p.phone)}</p>}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                {p.phone && (
                  <a href={`https://wa.me/55${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
                    onClick={e => e.stopPropagation()} className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all" title="WhatsApp">
                    <MessageCircle size={13} />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); nav(`/pacientes/${p.id}`); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-all" title="Prontuário">
                  <FileText size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); setEditing(p); setForm(p); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition-all" title="Editar">
                  <Edit size={13} />
                </button>
                <button onClick={async e => { e.stopPropagation(); try { const r = await fetch(`${API}/api/portal/generate-link`, { method: "POST", headers: auth(), body: JSON.stringify({ patientId: p.id, ownerId: "" }) }); const d = await r.json(); navigator.clipboard.writeText(window.location.origin + d.url); toast.success("Link do portal copiado!"); } catch { toast.error("Erro"); } }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all" title="Portal do Paciente"><ExternalLink size={13} /></button>
                <button onClick={e => { e.stopPropagation(); setDeleteTarget(p.id); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Remover">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Remover paciente" description="Esta ação não pode ser desfeita. Todos os dados do paciente serão removidos." confirmLabel="Remover" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

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
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Data nascimento</label>
              <input type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="input-premium w-full" /></div>
          </div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Endereço</label>
            <input value={form.address || ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-premium w-full" /></div>
          <div><label className="text-xs font-medium text-surface-500 mb-1 block">Observações</label>
            <textarea value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Salvar" : "Cadastrar"}</button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
}
