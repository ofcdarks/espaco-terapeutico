import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, StatCard, CardSkeleton } from "@/components/common";
import { useDashboard, useAppointments } from "@/hooks/useData";
import { formatCurrency, STATUS_CONFIG } from "@/lib/utils";
import { Users, Calendar, DollarSign, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { stats, chartData, loading } = useDashboard();
  const { data: appointments } = useAppointments();
  if (loading) return <MainLayout><PageHeader title="Dashboard" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">{[1,2,3,4].map(i=><CardSkeleton key={i}/>)}</div></MainLayout>;
  const s = stats || { totalPatients: 0, todayAppointments: 0, monthRevenue: 0, weekAppointments: 0, completedThisMonth: 0, canceledThisMonth: 0, monthExpenses: 0, pendingPayments: 0 };
  const todayAppts = appointments.filter(a => a.date === new Date().toISOString().split("T")[0]).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 5);
  return (
    <MainLayout>
      <PageHeader title="Dashboard" subtitle="Visão geral do seu consultório" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 page-enter" role="group" aria-label="Estatísticas">
        <StatCard icon={Users} label="Total de Pacientes" value={s.totalPatients} color="brand" />
        <StatCard icon={Calendar} label="Consultas Hoje" value={s.todayAppointments} color="emerald" />
        <StatCard icon={DollarSign} label="Receita do Mês" value={formatCurrency(s.monthRevenue)} color="emerald" />
        <StatCard icon={TrendingUp} label="Consultas na Semana" value={s.weekAppointments} color="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-4 sm:p-6 page-enter">
          <h3 className="text-sm font-semibold mb-4">Receita vs Despesas</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs><linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c5aff" stopOpacity={0.2}/><stop offset="95%" stopColor="#7c5aff" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} />
                <Area type="monotone" dataKey="receita" stroke="#7c5aff" fill="url(#gR)" strokeWidth={2} name="Receita" />
                <Area type="monotone" dataKey="despesa" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 5" name="Despesa" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-[260px] flex items-center justify-center text-surface-500 text-sm">Dados aparecerão ao registrar transações</div>}
        </div>
        <div className="glass-card p-4 sm:p-6 page-enter">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Hoje</h3>
            <Link to="/agenda" className="text-xs text-brand-600 hover:text-brand-400 flex items-center gap-1">Ver agenda <ArrowRight size={12} aria-hidden="true" /></Link>
          </div>
          {todayAppts.length === 0 ? <p className="text-sm text-surface-500 text-center py-8">Nenhuma consulta hoje</p> : (
            <div className="space-y-2" role="list" aria-label="Consultas de hoje">
              {todayAppts.map(apt => (
                <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/30" role="listitem">
                  <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center shrink-0"><Clock size={16} className="text-brand-600 dark:text-brand-300" aria-hidden="true" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{apt.patientName}</p><p className="text-xs text-surface-500">{apt.time} · {apt.duration}min</p></div>
                  <span className={`badge ${STATUS_CONFIG[apt.status]?.class}`}>{STATUS_CONFIG[apt.status]?.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 page-enter" role="group" aria-label="Resumo mensal">
        <div className="glass-card p-4"><p className="text-xs text-surface-500">Concluídas este mês</p><p className="text-xl font-semibold mt-1">{s.completedThisMonth}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-surface-500">Canceladas este mês</p><p className="text-xl font-semibold mt-1 text-red-500">{s.canceledThisMonth}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-surface-500">Despesas do mês</p><p className="text-xl font-semibold mt-1">{formatCurrency(s.monthExpenses)}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-surface-500">Pagamentos pendentes</p><p className="text-xl font-semibold mt-1 text-amber-500">{formatCurrency(s.pendingPayments)}</p></div>
      </div>
    </MainLayout>
  );
}
