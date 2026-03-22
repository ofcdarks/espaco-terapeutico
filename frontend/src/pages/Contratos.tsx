import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, SearchInput, EmptyState, TableSkeleton, Modal, ConfirmDialog, LoadingState } from "@/components/common";
import { usePatients } from "@/hooks/useData";
import { formatDate, useDebounce, STATUS_CONFIG } from "@/lib/utils";
import { FileSignature, Edit, Trash2, Eye, Printer, Send, Wand2, Copy, Check, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

const CONTRACT_TYPES: Record<string, { label: string; class: string }> = {
  terapia_individual: { label: "Terapia Individual", class: "badge-brand" },
  terapia_casal: { label: "Terapia de Casal", class: "badge-info" },
  terapia_grupo: { label: "Grupo", class: "badge-info" },
  teleconsulta: { label: "Teleconsulta", class: "badge-success" },
  lgpd: { label: "LGPD", class: "badge-warning" },
  personalizado: { label: "Personalizado", class: "badge-neutral" },
};

const CONTRACT_STATUS: Record<string, { label: string; class: string }> = {
  rascunho: { label: "Rascunho", class: "badge-neutral" },
  enviado: { label: "Enviado", class: "badge-info" },
  assinado: { label: "Assinado", class: "badge-success" },
  cancelado: { label: "Cancelado", class: "badge-danger" },
};

export default function Contratos() {
  const { data: patients } = usePatients();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); const dSearch = useDebounce(search, 300);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<any[]>([]);
  const [copied, setCopied] = useState("");
  const [form, setForm] = useState({ patientId: "", title: "", type: "terapia_individual", content: "", validUntil: "" });

  const refresh = async () => {
    try {
      const res = await fetch(`${API}/api/contracts?limit=200`, { headers: authHeader() });
      const data = await res.json();
      setContracts(data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    fetch(`${API}/api/contract-templates/defaults`, { headers: authHeader() }).then(r => r.json()).then(setDefaults).catch(() => {});
  }, []);

  const filtered = contracts.filter(c => c.patientName?.toLowerCase().includes(dSearch.toLowerCase()) || c.title?.toLowerCase().includes(dSearch.toLowerCase()));

  const openNew = () => { setEditing(null); setForm({ patientId: "", title: "Contrato de Psicoterapia", type: "terapia_individual", content: "", validUntil: "" }); setShowForm(true); };

  const applyTemplate = () => {
    const tpl = defaults.find(d => d.type === form.type);
    if (tpl) setForm(f => ({ ...f, content: tpl.content }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await fetch(`${API}/api/contracts/${editing.id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify({ title: form.title, content: form.content, validUntil: form.validUntil }) });
        toast.success("Contrato atualizado");
      } else {
        await fetch(`${API}/api/contracts/generate`, { method: 'POST', headers: authHeader(), body: JSON.stringify(form) });
        toast.success("Contrato gerado com variáveis preenchidas!");
      }
      setShowForm(false); refresh();
    } catch (err: any) { toast.error(err.message || "Erro"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await fetch(`${API}/api/contracts/${deleteTarget}`, { method: 'DELETE', headers: authHeader() });
    toast.success("Contrato removido"); setDeleteTarget(null); refresh();
  };

  const printContract = (id: string) => window.open(`${API}/api/contracts/${id}/print`, '_blank');

  const copySignLink = (id: string) => {
    const link = `${window.location.origin}/assinar/${id}`;
    navigator.clipboard.writeText(link);
    setCopied(id); setTimeout(() => setCopied(""), 2000);
    toast.success("Link de assinatura copiado!");
  };

  const markSent = async (id: string) => {
    await fetch(`${API}/api/contracts/${id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify({ status: 'enviado' }) });
    toast.success("Status atualizado para 'enviado'"); refresh();
  };

  if (loading) return <MainLayout><PageHeader title="Contratos" /><TableSkeleton /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Contratos" subtitle={`${contracts.length} contratos`} action={{ label: "Novo Contrato", onClick: openNew }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar contrato..." />
      </PageHeader>

      {filtered.length === 0 ? (
        <EmptyState icon={FileSignature} title="Nenhum contrato" description="Crie contratos terapêuticos, termos LGPD e de teleconsulta com templates prontos"
          action={{ label: "Novo Contrato", onClick: openNew }} />
      ) : (
        <div className="glass-card overflow-x-auto page-enter">
          <table className="table-premium" role="table" aria-label="Contratos">
            <thead><tr><th scope="col">Contrato</th><th scope="col">Paciente</th><th scope="col" className="hidden sm:table-cell">Tipo</th><th scope="col">Status</th><th scope="col" className="w-28"><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><p className="font-medium text-sm">{c.title}</p><p className="text-xs text-surface-500">{formatDate(c.createdAt)}</p></td>
                  <td className="text-sm">{c.patientName}</td>
                  <td className="hidden sm:table-cell"><span className={`badge ${CONTRACT_TYPES[c.type]?.class || "badge-neutral"}`}>{CONTRACT_TYPES[c.type]?.label || c.type}</span></td>
                  <td><span className={`badge ${CONTRACT_STATUS[c.status]?.class}`}>{CONTRACT_STATUS[c.status]?.label}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => copySignLink(c.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-green-600 transition-all" title="Link de assinatura">
                        {copied === c.id ? <Check size={14} className="text-green-500" /> : <Link2 size={14} />}
                      </button>
                      <button onClick={() => printContract(c.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" title="Imprimir"><Printer size={14} /></button>
                      <button onClick={() => setViewing(c)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" title="Ver"><Eye size={14} /></button>
                      {c.status === 'rascunho' && <button onClick={() => markSent(c.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-blue-500 transition-all" title="Marcar enviado"><Send size={14} /></button>}
                      <button onClick={() => { setEditing(c); setForm({ patientId: c.patientId, title: c.title, type: c.type || 'personalizado', content: c.content, validUntil: c.validUntil || "" }); setShowForm(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all" title="Editar"><Edit size={14} /></button>
                      <button onClick={() => setDeleteTarget(c.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all" title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Remover contrato" description="Esta ação não pode ser desfeita." confirmLabel="Remover" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ""} size="lg">
        {viewing && <>
          <div className="flex items-center gap-2 mb-3">
            <span className={`badge ${CONTRACT_STATUS[viewing.status]?.class}`}>{CONTRACT_STATUS[viewing.status]?.label}</span>
            {viewing.signedAt && <span className="text-xs text-surface-500">Assinado em {formatDate(viewing.signedAt)}</span>}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed font-serif bg-surface-50 dark:bg-surface-850 p-6 rounded-xl border border-surface-200 dark:border-surface-700 max-h-[60vh] overflow-y-auto">{viewing.content}</div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => printContract(viewing.id)} className="btn-primary flex items-center gap-2"><Printer size={14} /> Imprimir</button>
            <button onClick={() => copySignLink(viewing.id)} className="btn-secondary flex items-center gap-2"><Link2 size={14} /> Link de assinatura</button>
          </div>
        </>}
      </Modal>

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Contrato" : "Novo Contrato"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Tipo de Contrato</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-premium w-full">
                {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Paciente *</label>
              <select value={form.patientId} onChange={e => setForm(f => ({ ...f, patientId: e.target.value }))} className="input-premium w-full" required disabled={!!editing}>
                <option value="">Selecione...</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Título</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-premium w-full" required /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Válido até (opcional)</label>
              <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className="input-premium w-full" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-surface-500">Conteúdo do Contrato</label>
              <button type="button" onClick={applyTemplate} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-300 flex items-center gap-1"><Wand2 size={12} /> Usar modelo padrão</button>
            </div>
            <p className="text-[10px] text-surface-400 mb-1">Variáveis: {"{paciente}"} {"{cpf}"} {"{profissional}"} {"{crp}"} {"{data}"} {"{data_extenso}"} {"{valor_sessao}"} {"{duracao_sessao}"} {"{cidade}"} {"{estado}"} {"{especialidade}"} {"{consultorio}"} {"{modalidade}"}</p>
            <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="input-premium w-full h-64 py-3 resize-none font-mono text-xs leading-relaxed" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary">{editing ? "Salvar" : "Gerar Contrato"}</button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
}
