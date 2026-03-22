import { useEffect, useState } from "react";
import AdminLayout from "./AdminLayout";
import { StatCard, LoadingState } from "@/components/common";
import { Users, UserCheck, Calendar, Brain, DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || '';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/admin/stats`, { headers: headers() })
      .then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout><LoadingState /></AdminLayout>;
  const s = stats || {};

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-1">Painel Administrativo</h1>
      <p className="text-surface-500 text-sm mb-8">Visão geral da plataforma</p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={Users} label="Profissionais" value={s.totalUsers || 0} color="brand" />
        <StatCard icon={UserCheck} label="Pacientes (total)" value={s.totalPatients || 0} color="emerald" />
        <StatCard icon={Calendar} label="Consultas (total)" value={s.totalAppointments || 0} color="amber" />
        <StatCard icon={Brain} label="Transcrições" value={s.totalTranscriptions || 0} color="brand" />
        <StatCard icon={DollarSign} label="Receita Mês" value={formatCurrency(s.platformRevenue || 0)} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Usuários por Plano</h3>
          {s.usersByPlan?.length > 0 ? s.usersByPlan.map((p: any) => (
            <div key={p.planName} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800">
              <span className="text-sm">{p.planName || 'Sem plano'}</span>
              <span className="badge badge-brand">{p.count}</span>
            </div>
          )) : <p className="text-sm text-surface-500">Nenhum dado</p>}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4">Cadastros Recentes</h3>
          {s.recentSignups?.length > 0 ? s.recentSignups.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800">
              <div><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-surface-500">{u.email}</p></div>
              <span className="text-xs text-surface-500">{formatDate(u.createdAt)}</span>
            </div>
          )) : <p className="text-sm text-surface-500">Nenhum cadastro</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
