import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Modal, ConfirmDialog, EmptyState, LoadingState } from "@/components/common";
import { useAppointments, usePatients } from "@/hooks/useData";
import { appointmentExtras, whatsappApi } from "@/lib/api";
import { Calendar, Clock, Edit, Trash2, ChevronLeft, ChevronRight, Grid3X3, List, CalendarDays, Plus, MessageCircle, Check, Repeat } from "lucide-react";
import { STATUS_CONFIG, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Appointment } from "@/types";

type View = "day" | "week" | "month";
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h-19h

export default function Agenda() {
  const { data: appointments, loading, create, update, remove, refetch } = useAppointments();
  const { data: patients } = usePatients();
  const [view, setView] = useState<View>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState("");
  const [form, setForm] = useState({ patientId: "", date: "", time: "", duration: 50, type: "Consulta", notes: "", value: 0, recurring: false, recurringWeeks: 4 });

  const today = new Date().toISOString().split("T")[0];

  // Week dates
  const weekDates = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday); dd.setDate(monday.getDate() + i);
      return dd.toISOString().split("T")[0];
    });
  }, [currentDate]);

  // Month dates
  const monthDates = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0);
    const startDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const days: string[] = [];
    for (let i = -startDay; i <= last.getDate() + (6 - (last.getDay() === 0 ? 6 : last.getDay() - 1)); i++) {
      const dd = new Date(y, m, i + 1); days.push(dd.toISOString().split("T")[0]);
    }
    return days;
  }, [currentDate]);

  const getAppts = useCallback((date: string) => appointments.filter(a => a.date === date).sort((a, b) => a.time.localeCompare(b.time)), [appointments]);

  const shift = (n: number) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + n);
    else if (view === "week") d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    setCurrentDate(d);
  };

  const openNew = (date?: string, time?: string) => {
    setEditing(null); setConflictMsg("");
    setForm({ patientId: "", date: date || today, time: time || "09:00", duration: 50, type: "Consulta", notes: "", value: 0, recurring: false, recurringWeeks: 4 });
    setShowForm(true);
  };

  const checkConflict = async (date: string, time: string, dur: number) => {
    try {
      const res = await appointmentExtras.checkConflict(date, time, dur, editing?.id);
      if (res.hasConflict) { setConflictMsg(`Conflito com ${res.conflictWith} às ${res.conflictTime}`); }
      else { setConflictMsg(""); }
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === form.patientId);
    if (form.recurring && !editing) {
      await appointmentExtras.createRecurring({ ...form, patientName: patient?.name || "", value: Number(form.value) || undefined });
      toast.success(`${form.recurringWeeks} consultas criadas`);
    } else if (editing) {
      await update({ id: editing.id, ...form, patientName: patient?.name || "", value: Number(form.value) || undefined } as any);
    } else {
      await create({ ...form, patientName: patient?.name || "", value: Number(form.value) || undefined } as any);
    }
    setShowForm(false); refetch();
  };

  const handleConclude = async (id: string) => {
    try {
      const res = await appointmentExtras.conclude(id);
      toast.success(res.transactionCreated ? "Consulta concluída e receita gerada!" : "Consulta concluída");
      refetch();
    } catch { toast.error("Erro ao concluir"); }
  };

  const sendWhatsApp = async (aptId: string) => {
    try { await whatsappApi.sendReminder(aptId); toast.success("Lembrete WhatsApp enviado!"); }
    catch { toast.error("Erro: WhatsApp não configurado"); }
  };

  const label = view === "month"
    ? currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : view === "week"
    ? `${weekDates[0].split("-").reverse().join("/")} — ${weekDates[6].split("-").reverse().join("/")}`
    : new Date(currentDate).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  if (loading) return <MainLayout><LoadingState /></MainLayout>;

  return (
    <MainLayout>
      <PageHeader title="Agenda" action={{ label: "Nova Consulta", onClick: () => openNew() }}>
        <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
          {([["day", List], ["week", CalendarDays], ["month", Grid3X3]] as [View, any][]).map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === v ? "bg-white dark:bg-surface-700 shadow-sm" : "text-surface-500"}`} aria-label={v}><Icon size={14} /></button>
          ))}
        </div>
      </PageHeader>

      {/* Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => shift(-1)} className="btn-ghost p-2" aria-label="Anterior"><ChevronLeft size={18} /></button>
        <p className="text-sm font-semibold capitalize flex-1 text-center">{label}</p>
        <button onClick={() => shift(1)} className="btn-ghost p-2" aria-label="Próximo"><ChevronRight size={18} /></button>
        <button onClick={() => setCurrentDate(new Date())} className="btn-secondary text-xs">Hoje</button>
      </div>

      {/* === WEEK VIEW === */}
      {view === "week" && (
        <div className="glass-card overflow-x-auto page-enter">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-8 border-b border-surface-200 dark:border-surface-800">
              <div className="p-2 text-xs text-surface-500" />
              {weekDates.map(d => {
                const dd = new Date(d + "T12:00:00");
                const isToday = d === today;
                return <div key={d} className={`p-2 text-center border-l border-surface-200 dark:border-surface-800 ${isToday ? "bg-brand-50 dark:bg-brand-500/5" : ""}`}>
                  <p className="text-[10px] text-surface-500 uppercase">{dd.toLocaleDateString("pt-BR", { weekday: "short" })}</p>
                  <p className={`text-sm font-semibold ${isToday ? "text-brand-600 dark:text-brand-300" : ""}`}>{dd.getDate()}</p>
                </div>;
              })}
            </div>
            {/* Hour rows */}
            {HOURS.map(h => (
              <div key={h} className="grid grid-cols-8 min-h-[52px] border-b border-surface-100 dark:border-surface-800/50">
                <div className="p-1.5 text-[10px] text-surface-400 text-right pr-2">{String(h).padStart(2, "0")}:00</div>
                {weekDates.map(d => {
                  const appts = getAppts(d).filter(a => { const ah = parseInt(a.time.split(":")[0]); return ah === h; });
                  return <div key={d} className="border-l border-surface-100 dark:border-surface-800/50 p-0.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/20"
                    onClick={() => openNew(d, `${String(h).padStart(2, "0")}:00`)}>
                    {appts.map(a => (
                      <div key={a.id} className={`text-[10px] p-1 rounded-md mb-0.5 cursor-pointer truncate ${a.status === "concluido" ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : a.status === "cancelado" ? "bg-red-100 dark:bg-red-500/10 text-red-600 line-through" : "bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400"}`}
                        onClick={e => { e.stopPropagation(); setEditing(a); setForm({ patientId: a.patientId, date: a.date, time: a.time, duration: a.duration, type: a.type, notes: a.notes || "", value: a.value || 0, recurring: false, recurringWeeks: 4 }); setShowForm(true); }}>
                        <span className="font-semibold">{a.time}</span> {a.patientName}
                      </div>
                    ))}
                  </div>;
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === MONTH VIEW === */}
      {view === "month" && (
        <div className="glass-card overflow-hidden page-enter">
          <div className="grid grid-cols-7">
            {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => <div key={d} className="p-2 text-center text-[10px] font-medium text-surface-500 uppercase border-b border-surface-200 dark:border-surface-800">{d}</div>)}
            {monthDates.map(d => {
              const dd = new Date(d + "T12:00:00");
              const isCurrentMonth = dd.getMonth() === currentDate.getMonth();
              const isToday = d === today;
              const appts = getAppts(d);
              return <div key={d} className={`min-h-[80px] p-1 border-b border-r border-surface-100 dark:border-surface-800/50 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/20 ${!isCurrentMonth ? "opacity-40" : ""}`}
                onClick={() => { setCurrentDate(new Date(d + "T12:00:00")); setView("day"); }}>
                <p className={`text-xs font-medium mb-1 ${isToday ? "w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center" : ""}`}>{dd.getDate()}</p>
                {appts.slice(0, 3).map(a => <div key={a.id} className="text-[9px] bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 rounded px-1 mb-0.5 truncate">{a.time} {a.patientName}</div>)}
                {appts.length > 3 && <p className="text-[9px] text-surface-500">+{appts.length - 3} mais</p>}
              </div>;
            })}
          </div>
        </div>
      )}

      {/* === DAY VIEW === */}
      {view === "day" && (
        <div className="space-y-2 page-enter">
          {getAppts(currentDate.toISOString().split("T")[0]).length === 0 ? (
            <EmptyState icon={Calendar} title="Nenhuma consulta" description="Nenhuma consulta neste dia" action={{ label: "Agendar", onClick: () => openNew(currentDate.toISOString().split("T")[0]) }} />
          ) : getAppts(currentDate.toISOString().split("T")[0]).map(apt => (
            <div key={apt.id} className="glass-card p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-600/10 flex flex-col items-center justify-center shrink-0">
                <Clock size={14} className="text-brand-600 dark:text-brand-300" /><span className="text-xs font-semibold text-brand-600 dark:text-brand-300">{apt.time}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><p className="font-medium">{apt.patientName}</p><span className={`badge ${STATUS_CONFIG[apt.status]?.class}`}>{STATUS_CONFIG[apt.status]?.label}</span></div>
                <p className="text-xs text-surface-500 mt-0.5">{apt.type} · {apt.duration}min{apt.value ? ` · ${formatCurrency(apt.value)}` : ""}</p>
              </div>
              <div className="flex gap-1 shrink-0 flex-wrap">
                {!["concluido","cancelado"].includes(apt.status) && <>
                  <button onClick={() => handleConclude(apt.id)} className="btn-ghost text-xs text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hidden sm:flex items-center gap-1"><Check size={12}/>Concluir</button>
                  <button onClick={() => sendWhatsApp(apt.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-green-500 transition-all" title="Enviar WhatsApp"><MessageCircle size={14}/></button>
                </>}
                <button onClick={() => { setEditing(apt); setForm({ patientId: apt.patientId, date: apt.date, time: apt.time, duration: apt.duration, type: apt.type, notes: apt.notes || "", value: apt.value || 0, recurring: false, recurringWeeks: 4 }); setShowForm(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-brand-600 transition-all"><Edit size={14}/></button>
                <button onClick={() => setDeleteTarget(apt.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Remover consulta" description="Deseja remover esta consulta?" confirmLabel="Remover"
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget); setDeleteTarget(null); }} onCancel={() => setDeleteTarget(null)} />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Editar Consulta" : "Nova Consulta"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label htmlFor="a-p" className="text-xs font-medium text-surface-500 mb-1 block">Paciente *</label>
            <select id="a-p" value={form.patientId} onChange={e => setForm(f => ({...f, patientId: e.target.value}))} className="input-premium w-full" required><option value="">Selecione...</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Data *</label><input type="date" value={form.date} onChange={e => { setForm(f => ({...f, date: e.target.value})); checkConflict(e.target.value, form.time, form.duration); }} className="input-premium w-full" required /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Horário *</label><input type="time" value={form.time} onChange={e => { setForm(f => ({...f, time: e.target.value})); checkConflict(form.date, e.target.value, form.duration); }} className="input-premium w-full" required /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Duração</label><input type="number" value={form.duration} onChange={e => setForm(f => ({...f, duration: +e.target.value}))} className="input-premium w-full" /></div>
          </div>
          {conflictMsg && <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs" role="alert">⚠️ {conflictMsg}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Tipo</label><input value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="input-premium w-full" /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1 block">Valor (R$)</label><input type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({...f, value: +e.target.value}))} className="input-premium w-full" /></div>
          </div>
          {!editing && <div className="flex items-center gap-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-800/30">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({...f, recurring: e.target.checked}))} className="w-4 h-4 rounded border-surface-300 text-brand-600" /><Repeat size={14} className="text-brand-600"/>Recorrente</label>
            {form.recurring && <div className="flex items-center gap-2"><label className="text-xs text-surface-500">Semanas:</label><input type="number" min={2} max={52} value={form.recurringWeeks} onChange={e => setForm(f => ({...f, recurringWeeks: +e.target.value}))} className="input-premium w-16 text-center" /></div>}
          </div>}
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">{editing ? "Salvar" : form.recurring ? `Criar ${form.recurringWeeks} consultas` : "Agendar"}</button></div>
        </form>
      </Modal>
    </MainLayout>
  );
}
