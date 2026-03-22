import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog, MaskedInput } from "@/components/common";
import { usePatients } from "@/hooks/useData";
import { Users, Phone, Mail, Edit, Trash2, ExternalLink, Upload, Download, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { csvApi, portalApi } from "@/lib/api";
import { formatDate, maskCpf, maskPhone, useDebounce, STATUS_CONFIG, getInitials } from "@/lib/utils";
import type { Patient } from "@/types";

export default function Pacientes() {
  const { data: patients, loading, create, update, remove } = usePatients();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", birthDate: "", cpf: "", notes: "", status: "ativo" });

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    p.phone?.includes(debouncedSearch)
  );

  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const handleImport = async () => { try { const res = await csvApi.importPatients(csvText); toast.success(`${res.imported} pacientes importados!`); setShowImport(false); setCsvText(""); } catch (e: any) { toast.error(e.message); } };
  const exportCSV = () => { const a = document.createElement("a"); a.href = csvApi.exportPatientsUrl(); a.download = "pacientes.csv"; a.click(); toast.success("Download iniciado"); };
  const getPortalLink = async (patientId: string, name: string) => { try { const r = await portalApi.getLink(patientId); navigator.clipboard.writeText(window.location.origin + r.url); toast.success(`Link do portal de ${name} copiado!`); } catch { toast.error("Erro ao gerar link"); } };
  const openNew = () => { setEditing(null); setForm({ name: "", email: "", phone: "", birthDate: "", cpf: "", notes: "", status: "ativo" }); setShowForm(true); };
  const openEdit = (p: Patient) => { setEditing(p); setForm({ name: p.name, email: p.email, phone: p.phone, birthDate: p.birthDate || "", cpf: p.cpf || "", notes: p.notes || "", status: p.status }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await update({ id: editing.id, ...form } as any);
    else await create(form as any);
    setShowForm(false);
  };

  if (loading) return <MainLayout><PageHeader title="Pacientes" /><TableSkeleton /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Pacientes" subtitle={`${patients.length} pacientes cadastrados`} action={{ label: "Novo Paciente", onClick: openNew }}>
        <div className="flex gap-2"><button onClick={exportCSV} className="btn-ghost text-xs h-8 flex items-center gap-1" title="Exportar CSV"><Download size={14}/><span className="hidden sm:inline">Exportar</span></button><button onClick={() => setShowImport(true)} className="btn-ghost text-xs h-8 flex items-center gap-1" title="Importar CSV"><Upload size={14}/><span className="hidden sm:inline">Importar</span></button></div>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar paciente..." />
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum paciente" description="Comece cadastrando seu primeiro paciente" action={{ label: "Novo Paciente", onClick: openNew }} />
      ) : (
        <div className="glass-card overflow-x-auto page-enter">
          <table className="table-premium" role="table" aria-label="Lista de pacientes">
            <thead><tr><th scope="col">Paciente</th><th scope="col">Contato</th><th scope="col" className="hidden sm:table-cell">CPF</th><th scope="col">Status</th><th scope="col" className="w-10"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center text-xs font-semibold text-brand-600 dark:text-brand-300 shrink-0" aria-hidden="true">{getInitials(p.name)}</div>
                      <div><p className="font-medium text-sm">{p.name}</p>{p.birthDate && <p className="text-xs text-surface-500">{formatDate(p.birthDate)}</p>}</div>
                    </div>
                  </td>
                  <td><div className="space-y-0.5">{p.email && <div className="flex items-center gap-1.5 text-xs text-surface-500"><Mail size={12} aria-hidden="true" />{p.email}</div>}{p.phone && <div className="flex items-center gap-1.5 text-xs text-surface-500"><Phone size={12} aria-hidden="true" />{maskPhone(p.phone)}</div>}</div></td>
                  <td className="text-xs font-mono hidden sm:table-cell">{p.cpf ? maskCpf(p.cpf) : "—"}</td>
                  <td><span className={`badge ${STATUS_CONFIG[p.status]?.class || "badge-neutral"}`}>{STATUS_CONFIG[p.status]?.label}</span></td>
                  <td><div className="flex items-center gap-1">
                    <button onClick={() => getPortalLink(p.id, p.name)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-all" aria-label={`Portal de ${p.name}`} title="Copiar link do portal"><Link2 size={14} /></button>
                    <Link to={`/pacientes/${p.id}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all" aria-label={`Ver detalhes de ${p.name}`}><ExternalLink size={14} /></Link>
                    <button onClick={() => openEdit(p)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all" aria-label={`Editar ${p.name}`}><Edit size={14} /></button>
                    <button onClick={() => setDeleteTarget(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" aria-label={`Remover ${p.name}`}><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Remover paciente" description="Esta ação não pode ser desfeita. Todos os registros vinculados serão mantidos." confirmLabel="Remover"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Paciente" : "Novo Paciente"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label htmlFor="p-name" className="text-xs font-medium text-surface-500 mb-1 block">Nome completo *</label>
              <input id="p-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-premium w-full" required autoFocus /></div>
            <div><label htmlFor="p-email" className="text-xs font-medium text-surface-500 mb-1 block">Email</label>
              <input id="p-email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-premium w-full" /></div>
            <div><label htmlFor="p-phone" className="text-xs font-medium text-surface-500 mb-1 block">Telefone</label>
              <MaskedInput id="p-phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} mask={maskPhone} className="w-full" inputMode="numeric" /></div>
            <div><label htmlFor="p-birth" className="text-xs font-medium text-surface-500 mb-1 block">Data de Nascimento</label>
              <input id="p-birth" type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} className="input-premium w-full" /></div>
            <div><label htmlFor="p-cpf" className="text-xs font-medium text-surface-500 mb-1 block">CPF</label>
              <MaskedInput id="p-cpf" value={form.cpf} onChange={v => setForm(f => ({ ...f, cpf: v }))} mask={maskCpf} className="w-full" inputMode="numeric" /></div>
            <div className="sm:col-span-2"><label htmlFor="p-notes" className="text-xs font-medium text-surface-500 mb-1 block">Observações</label>
              <textarea id="p-notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-premium w-full h-20 py-2 resize-none" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Salvar" : "Cadastrar"}</button>
          </div>
        </form>
      </Modal>
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Importar Pacientes (CSV)">
        <div className="space-y-4">
          <p className="text-xs text-surface-500">Cole o conteúdo do CSV abaixo. O arquivo deve ter uma coluna "nome" (obrigatória). Colunas opcionais: email, telefone, cpf.</p>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)} className="input-premium w-full h-40 py-2 resize-none font-mono text-xs" placeholder="nome,email,telefone,cpf
João Silva,joao@email.com,11999999999,12345678901" />
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowImport(false)} className="btn-secondary">Cancelar</button><button onClick={handleImport} className="btn-primary">Importar</button></div>
        </div>
      </Modal>
    </MainLayout>
  );
}
