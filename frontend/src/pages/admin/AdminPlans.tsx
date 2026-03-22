import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Modal, ConfirmDialog, LoadingState } from "@/components/common";
import { Plus, Edit, Trash2, CreditCard, Brain, Video, MessageCircle, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function AdminPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', maxPatients: 50, maxAppointmentsMonth: 100, price: 0, hasAI: false, hasTelehealth: true, hasWhatsapp: false, hasTranscription: false });

  const fetchPlans = () => fetch(`${API}/api/admin/plans`, { headers: headers() }).then(r => r.json()).then(setPlans).finally(() => setLoading(false));
  useEffect(() => { fetchPlans(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await fetch(`${API}/api/admin/plans/${editing.id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(form) });
    } else {
      await fetch(`${API}/api/admin/plans`, { method: 'POST', headers: headers(), body: JSON.stringify(form) });
    }
    toast.success(editing ? "Plano atualizado" : "Plano criado"); setShowForm(false); fetchPlans();
  };

  const del = async () => {
    if (!deleteTarget) return;
    await fetch(`${API}/api/admin/plans/${deleteTarget}`, { method: 'DELETE', headers: headers() });
    toast.success("Plano removido"); setDeleteTarget(null); fetchPlans();
  };

  const openNew = () => { setEditing(null); setForm({ name: '', slug: '', maxPatients: 50, maxAppointmentsMonth: 100, price: 0, hasAI: false, hasTelehealth: true, hasWhatsapp: false, hasTranscription: false }); setShowForm(true); };

  if (loading) return <AdminLayout><LoadingState /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-semibold">Planos</h1><p className="text-surface-500 text-sm mt-1">Gerencie os planos de assinatura</p></div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />Novo Plano</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(p => (
          <div key={p.id} className="glass-card p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(p); setForm(p); setShowForm(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-500"><Edit size={14} /></button>
                <button onClick={() => setDeleteTarget(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-400 mb-1">{p.price === 0 ? 'Grátis' : formatCurrency(p.price)}<span className="text-sm font-normal text-surface-500">/mês</span></p>
            <p className="text-xs text-surface-500 mb-4">slug: {p.slug}</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-surface-500">Pacientes</span><span className="font-medium">{p.maxPatients >= 9999 ? 'Ilimitado' : p.maxPatients}</span></div>
              <div className="flex items-center justify-between"><span className="text-surface-500">Consultas/mês</span><span className="font-medium">{p.maxAppointmentsMonth >= 9999 ? 'Ilimitado' : p.maxAppointmentsMonth}</span></div>
              <div className="flex items-center gap-3 pt-2 flex-wrap">
                {p.hasAI && <span className="badge badge-brand flex items-center gap-1"><Brain size={10} />IA</span>}
                {p.hasTelehealth && <span className="badge badge-success flex items-center gap-1"><Video size={10} />Telecons.</span>}
                {p.hasWhatsapp && <span className="badge badge-success flex items-center gap-1"><MessageCircle size={10} />WhatsApp</span>}
                {p.hasTranscription && <span className="badge badge-info flex items-center gap-1"><FileText size={10} />Transcrição</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog open={!!deleteTarget} title="Excluir plano" description="Usuários deste plano perderão acesso às features." confirmLabel="Excluir" onConfirm={del} onCancel={() => setDeleteTarget(null)} />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Plano" : "Novo Plano"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Nome</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-premium w-full" required /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Slug</label><input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="input-premium w-full" required /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Preço (R$/mês)</label><input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))} className="input-premium w-full" /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Max Pacientes</label><input type="number" value={form.maxPatients} onChange={e => setForm(f => ({ ...f, maxPatients: +e.target.value }))} className="input-premium w-full" /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Max Consultas/mês</label><input type="number" value={form.maxAppointmentsMonth} onChange={e => setForm(f => ({ ...f, maxAppointmentsMonth: +e.target.value }))} className="input-premium w-full" /></div>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            {['hasAI','hasTelehealth','hasWhatsapp','hasTranscription'].map(k => (
              <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} className="w-4 h-4 rounded" />
                {k === 'hasAI' ? 'IA' : k === 'hasTelehealth' ? 'Teleconsulta' : k === 'hasWhatsapp' ? 'WhatsApp' : 'Transcrição'}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Salvar" : "Criar"}</button></div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
