import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, appointmentsApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, DollarSign, Building2, Cake, Users, Clock, TrendingUp, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "@/lib/utils";


import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: stats } = useQuery({ queryKey: ["dash-stats"], queryFn: dashboardApi.stats });
  const { data: chart } = useQuery({ queryKey: ["dash-chart"], queryFn: dashboardApi.revenueChart });
  const { data: appts } = useQuery({ queryKey: ["appointments"], queryFn: () => appointmentsApi.list(200) });

  const today = new Date().toISOString().split("T")[0];
  const todayAppts = (appts?.data || []).filter((a: any) => a.date === today);
  const pendingPayments = stats?.pendingRevenue || 0;

  const topCards = [
    { icon: Calendar, color: "bg-emerald-500", title: "Agenda do Dia", value: `${todayAppts.length} sessões`, sub: todayAppts.length === 0 ? "Sem sessões hoje" : `Próxima: ${todayAppts[0]?.time || ""}`, onClick: () => nav("/agenda") },
    { icon: DollarSign, color: "bg-amber-500", title: "Cobranças", value: `R$ ${pendingPayments.toFixed(0)}`, sub: `${stats?.todayAppointments || 0} cobranças esta semana`, onClick: () => nav("/financeiro") },
    { icon: Building2, color: "bg-blue-500", title: "Informações da clínica", value: "Acompanhe", sub: "Sessões, presença e faturamento", onClick: () => nav("/relatorios") },
    { icon: Cake, color: "bg-pink-500", title: "Aniversários", value: `${stats?.birthdaysThisWeek || 0}`, sub: "aniversários esta semana", onClick: () => nav("/pacientes") },
  ];

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Olá, {user?.name?.split(" ")[0]}!</h1>
        <p className="text-sm text-surface-500 mt-1">Resumo do seu consultório</p>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {topCards.map((c, i) => (
          <button key={i} onClick={c.onClick} className="glass-card p-4 flex items-start gap-3 text-left hover:shadow-elevated transition-all group">
            <div className={`w-10 h-10 rounded-xl ${c.color} flex items-center justify-center shrink-0`}>
              <c.icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-surface-500">{c.title}</p>
              <p className="text-lg font-semibold mt-0.5">{c.value}</p>
              <p className="text-[11px] text-surface-400 truncate">{c.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: today's appointments */}
        <div className="lg:col-span-1">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Clock size={14} className="text-brand-600" /> Consultas Hoje</h2>
              <button onClick={() => nav("/agenda")} className="text-[10px] text-brand-600 dark:text-brand-300 flex items-center gap-1">Ver agenda <ArrowRight size={10} /></button>
            </div>
            {todayAppts.length === 0 ? (
              <p className="text-xs text-surface-400 py-8 text-center">Nenhuma consulta agendada para hoje</p>
            ) : (
              <div className="space-y-2">
                {todayAppts.slice(0, 6).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-850 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center text-brand-600 dark:text-brand-300 text-xs font-bold shrink-0">
                      {a.time?.slice(0, 5)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{a.patientName}</p>
                      <p className="text-[10px] text-surface-500">{a.duration}min · {a.type || "Consulta"}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${a.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: chart + stats */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-brand-600" /> Faturamento</h2>
            <div className="h-48">
              {chart && chart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs><linearGradient id="grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54423b" stopOpacity={0.2} /><stop offset="100%" stopColor="#54423b" stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#b8b0aa' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#b8b0aa' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#54423b" fill="url(#grad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-surface-400 text-center py-12">Sem dados de faturamento</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">{stats?.totalPatients || 0}</p>
              <p className="text-xs text-surface-500 mt-1">Pacientes</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">{stats?.totalAppointments || 0}</p>
              <p className="text-xs text-surface-500 mt-1">Consultas</p>
            </div>
            <div className="glass-card p-4 text-center">
              <p className="text-2xl font-bold">R$ {(stats?.totalRevenue || 0).toFixed(0)}</p>
              <p className="text-xs text-surface-500 mt-1">Faturamento</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
