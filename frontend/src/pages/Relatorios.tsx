import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, CardSkeleton } from "@/components/common";
import { useDashboard, usePatients, useAppointments, useTransactions } from "@/hooks/useData";
import { formatCurrency } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { Download, Filter } from "lucide-react";
import { toast } from "sonner";
const COLORS = ["#7c5aff","#10b981","#f59e0b","#ef4444","#3b82f6","#ec4899"];

export default function Relatorios() {
  const { stats, chartData, loading } = useDashboard();
  const { data: patients } = usePatients();
  const { data: appointments } = useAppointments();
  const { data: transactions } = useTransactions();
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-6); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Filtered data by date range
  const fAppts = useMemo(() => appointments.filter(a => a.date >= startDate && a.date <= endDate), [appointments, startDate, endDate]);
  const fTxs = useMemo(() => transactions.filter(t => t.date >= startDate && t.date <= endDate), [transactions, startDate, endDate]);

  const revenue = fTxs.filter(t => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.value, 0);
  const expenses = fTxs.filter(t => t.type === "despesa" && t.status === "pago").reduce((s, t) => s + t.value, 0);
  const completed = fAppts.filter(a => a.status === "concluido").length;
  const canceled = fAppts.filter(a => a.status === "cancelado").length;

  const appointmentsByType = useMemo(() => { const m: Record<string,number> = {}; fAppts.forEach(a => { m[a.type||"Outros"]=(m[a.type||"Outros"]||0)+1; }); return Object.entries(m).map(([name,value]) => ({ name: name.slice(0,18), value })); }, [fAppts]);
  const statusData = useMemo(() => [
    { name:"Agendado", value: fAppts.filter(a=>a.status==="agendado").length },
    { name:"Confirmado", value: fAppts.filter(a=>a.status==="confirmado").length },
    { name:"Concluído", value: fAppts.filter(a=>a.status==="concluido").length },
    { name:"Cancelado", value: fAppts.filter(a=>a.status==="cancelado").length },
  ].filter(d=>d.value>0), [fAppts]);

  // Export CSV
  const exportCSV = (type: "appointments" | "transactions") => {
    const data = type === "appointments" ? fAppts : fTxs;
    if (data.length === 0) { toast.error("Sem dados para exportar"); return; }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(r => Object.values(r).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${type}-${startDate}-${endDate}.csv`; a.click();
    toast.success(`${data.length} registros exportados`);
  };

  if (loading) return <MainLayout><PageHeader title="Relatórios"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><CardSkeleton key={i}/>)}</div></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Relatórios" subtitle="Análise do seu consultório">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-surface-400"/>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-premium w-36 text-xs" aria-label="Data início"/>
          <span className="text-surface-400 text-xs">até</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-premium w-36 text-xs" aria-label="Data fim"/>
          <button onClick={() => exportCSV("appointments")} className="btn-secondary h-8 text-xs flex items-center gap-1"><Download size={12}/>Consultas</button>
          <button onClick={() => exportCSV("transactions")} className="btn-secondary h-8 text-xs flex items-center gap-1"><Download size={12}/>Financeiro</button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 page-enter">
        {[
          { l:"Receita Líquida", v: formatCurrency(revenue-expenses), c: revenue-expenses>=0?"text-emerald-500":"text-red-500" },
          { l:"Ticket Médio", v: completed>0?formatCurrency(revenue/completed):"R$ 0", c:"text-brand-600" },
          { l:"Taxa Cancel.", v: fAppts.length>0?`${Math.round(canceled/fAppts.length*100)}%`:"0%", c: canceled>0?"text-red-500":"" },
          { l:"Sessões Concluídas", v: String(completed), c:"" },
        ].map((k,i) => <div key={i} className="glass-card p-5"><p className="text-xs text-surface-500 mb-1">{k.l}</p><p className={`text-2xl font-semibold ${k.c}`}>{k.v}</p></div>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-4 sm:p-6 page-enter"><h3 className="text-sm font-semibold mb-4">Receita vs Despesas</h3>
          {chartData.length>0?(<ResponsiveContainer width="100%" height={280}><AreaChart data={chartData}><defs><linearGradient id="rG3" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c5aff" stopOpacity={0.2}/><stop offset="95%" stopColor="#7c5aff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis dataKey="month" tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))"/><YAxis tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))"/><Tooltip contentStyle={{borderRadius:12,border:"1px solid hsl(var(--border))",background:"hsl(var(--card))",fontSize:12}}/><Area type="monotone" dataKey="receita" stroke="#7c5aff" fill="url(#rG3)" strokeWidth={2}/><Area type="monotone" dataKey="despesa" stroke="#f59e0b" fill="transparent" strokeWidth={2} strokeDasharray="5 5"/></AreaChart></ResponsiveContainer>):<div className="h-[280px] flex items-center justify-center text-surface-500 text-sm">Sem dados</div>}</div>
        <div className="glass-card p-4 sm:p-6 page-enter"><h3 className="text-sm font-semibold mb-4">Consultas por Status</h3>
          {statusData.length>0?(<ResponsiveContainer width="100%" height={280}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>{statusData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>):<div className="h-[280px] flex items-center justify-center text-surface-500 text-sm">Sem dados</div>}</div>
      </div>
      <div className="glass-card p-4 sm:p-6 page-enter"><h3 className="text-sm font-semibold mb-4">Consultas por Tipo</h3>
        {appointmentsByType.length>0?(<ResponsiveContainer width="100%" height={280}><BarChart data={appointmentsByType} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/><XAxis type="number" tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))"/><YAxis type="category" dataKey="name" tick={{fontSize:11}} stroke="hsl(var(--muted-foreground))" width={120}/><Tooltip/><Bar dataKey="value" fill="#7c5aff" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer>):<div className="h-[280px] flex items-center justify-center text-surface-500 text-sm">Sem dados</div>}</div>
    </MainLayout>);
}
