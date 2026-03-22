import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { SearchInput, LoadingState, ConfirmDialog, Modal } from "@/components/common";
import { Edit, Trash2, Shield, ShieldOff, CreditCard } from "lucide-react";
import { formatDate, useDebounce } from "@/lib/utils";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const ds = useDebounce(search, 300);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [planModal, setPlanModal] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState('');

  const fetchUsers = () => fetch(`${API}/api/admin/users?search=${ds}`, { headers: headers() })
    .then(r => r.json()).then(d => setUsers(d.data || [])).finally(() => setLoading(false));

  useEffect(() => { fetchUsers(); fetch(`${API}/api/admin/plans`, { headers: headers() }).then(r => r.json()).then(setPlans); }, [ds]);

  const toggleAdmin = async (id: string, current: string) => {
    await fetch(`${API}/api/admin/users/${id}`, { method: 'PATCH', headers: headers(), body: JSON.stringify({ role: current === 'admin' ? 'user' : 'admin' }) });
    toast.success("Role atualizada"); fetchUsers();
  };

  const deleteUser = async () => {
    if (!deleteTarget) return;
    await fetch(`${API}/api/admin/users/${deleteTarget}`, { method: 'DELETE', headers: headers() });
    toast.success("Usuário removido"); setDeleteTarget(null); fetchUsers();
  };

  const assignPlan = async () => {
    if (!planModal || !selectedPlan) return;
    await fetch(`${API}/api/admin/users/${planModal.id}/plan`, { method: 'POST', headers: headers(), body: JSON.stringify({ planId: selectedPlan, status: 'active' }) });
    toast.success("Plano atribuído"); setPlanModal(null); fetchUsers();
  };

  if (loading) return <AdminLayout><LoadingState /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-semibold">Usuários</h1><p className="text-surface-500 text-sm mt-1">{users.length} profissionais cadastrados</p></div>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar usuário..." />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="table-premium"><thead><tr><th>Usuário</th><th>Plano</th><th>Pacientes</th><th>Role</th><th>Cadastro</th><th className="w-20">Ações</th></tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id}>
              <td><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-surface-500">{u.email}</p></td>
              <td><span className={`badge ${u.planStatus === 'active' ? 'badge-success' : 'badge-neutral'}`}>{u.plan}</span></td>
              <td className="text-sm">{u.patientCount}</td>
              <td>{u.role === 'admin' ? <span className="badge badge-danger">Admin</span> : <span className="badge badge-neutral">User</span>}</td>
              <td className="text-xs text-surface-500">{formatDate(u.createdAt)}</td>
              <td><div className="flex gap-1">
                <button onClick={() => { setPlanModal(u); setSelectedPlan(''); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-500 transition-all" title="Atribuir plano"><CreditCard size={14} /></button>
                <button onClick={() => toggleAdmin(u.id, u.role)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-amber-500 transition-all" title={u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}>{u.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}</button>
                <button onClick={() => setDeleteTarget(u.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all" title="Excluir"><Trash2 size={14} /></button>
              </div></td>
            </tr>
          ))}</tbody></table>
      </div>

      <ConfirmDialog open={!!deleteTarget} title="Excluir usuário" description="Isso removerá o profissional e TODOS os seus dados (pacientes, consultas, etc). Essa ação não pode ser desfeita." confirmLabel="Excluir"
        onConfirm={deleteUser} onCancel={() => setDeleteTarget(null)} />

      <Modal open={!!planModal} onClose={() => setPlanModal(null)} title={`Atribuir plano — ${planModal?.name}`} size="sm">
        <div className="space-y-4">
          <div className="space-y-2">{plans.map(p => (
            <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedPlan === p.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/30'}`}>
              <input type="radio" name="plan" value={p.id} checked={selectedPlan === p.id} onChange={() => setSelectedPlan(p.id)} className="hidden" />
              <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-surface-500">{p.maxPatients} pacientes · R${p.price}/mês</p></div>
              {selectedPlan === p.id && <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs">✓</div>}
            </label>
          ))}</div>
          <button onClick={assignPlan} disabled={!selectedPlan} className="btn-primary w-full">Atribuir Plano</button>
        </div>
      </Modal>
    </AdminLayout>
  );
}
