import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { LoadingState, Modal, ConfirmDialog } from "@/components/common";
import { patientsApi, appointmentsApi, recordsApi, transactionsApi, documentsApi, lgpdApi, portalApi } from "@/lib/api";
import { formatCurrency, formatDate, maskCpf, maskPhone, STATUS_CONFIG, getInitials } from "@/lib/utils";
import { ArrowLeft, Calendar, FileText, DollarSign, Clock, Mail, Phone, MapPin, Download, Trash2, Shield, FileCheck, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Patient, Appointment, ConsultationRecord, Transaction, Document } from "@/types";

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<ConsultationRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("timeline");
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [portalLink, setPortalLink] = useState("");

  const generatePortalLink = async () => {
    if (!id) return;
    try {
      const { token } = await portalApi.generateLink(id);
      const link = `${window.location.origin}/portal/${token}`;
      setPortalLink(link);
      navigator.clipboard.writeText(link);
      toast.success("Link do portal copiado!");
    } catch { toast.error("Erro ao gerar link"); }
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      patientsApi.getById(id).then(setPatient),
      appointmentsApi.list({ limit: 100 }).then(r => setAppointments(r.data.filter((a: any) => a.patientId === id))),
      recordsApi.list({ limit: 100 }).then(r => setRecords(r.data.filter((a: any) => a.patientId === id))),
      transactionsApi.list({ limit: 100 }).then(r => setTransactions(r.data.filter((a: any) => a.patientId === id))),
      documentsApi.list({ limit: 100 }).then(r => setDocuments(r.data.filter((a: any) => a.patientId === id))),
      lgpdApi.getConsents(id).then(setConsents).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <MainLayout><LoadingState /></MainLayout>;
  if (!patient) return <MainLayout><div className="text-center py-20"><p className="text-surface-500">Paciente não encontrado</p><Link to="/pacientes" className="btn-primary mt-4 inline-block">Voltar</Link></div></MainLayout>;

  const timeline = [
    ...appointments.map(a => ({ date: a.date, time: a.time, type: "appointment" as const, data: a })),
    ...records.map(r => ({ date: r.date, time: "00:00", type: "record" as const, data: r })),
    ...transactions.map(t => ({ date: t.date, time: "00:00", type: "transaction" as const, data: t })),
    ...documents.map(d => ({ date: d.date, time: "00:00", type: "document" as const, data: d })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const totalPaid = transactions.filter(t => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.value, 0);
  const totalPending = transactions.filter(t => t.type === "receita" && t.status === "pendente").reduce((s, t) => s + t.value, 0);

  const exportData = async () => {
    try {
      const data = await lgpdApi.exportData(id!);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `paciente-${patient.name.replace(/\s/g, "_")}.json`; a.click();
      toast.success("Dados exportados");
    } catch { toast.error("Erro ao exportar"); }
  };

  const TABS = ["timeline", "consultas", "prontuarios", "financeiro", "documentos", "lgpd"];

  return (
    <MainLayout>
      <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-foreground mb-4"><ArrowLeft size={14}/>Voltar</Link>

      {/* Patient card */}
      <div className="glass-card p-6 mb-6 page-enter">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-500/10 flex items-center justify-center text-xl font-bold text-brand-600 dark:text-brand-300 shrink-0">{getInitials(patient.name)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap"><h1 className="text-xl font-semibold">{patient.name}</h1><span className={`badge ${STATUS_CONFIG[patient.status]?.class}`}>{STATUS_CONFIG[patient.status]?.label}</span></div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-surface-500">
              {patient.email && <span className="flex items-center gap-1"><Mail size={13}/>{patient.email}</span>}
              {patient.phone && <span className="flex items-center gap-1"><Phone size={13}/>{maskPhone(patient.phone)}</span>}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={generatePortalLink} className="btn-primary h-8 text-xs flex items-center gap-1.5"><ExternalLink size={12} /> Portal do Paciente</button>
              {portalLink && <button onClick={() => { navigator.clipboard.writeText(portalLink); toast.success("Link copiado!"); }} className="btn-ghost h-8 text-xs flex items-center gap-1.5"><Copy size={12} /> Copiar Link</button>}
            </div>
            {portalLink && <code className="text-[10px] text-surface-400 block mt-1 break-all">{portalLink}</code>}
              {patient.cpf && <span className="flex items-center gap-1">CPF: {maskCpf(patient.cpf)}</span>}
              {patient.birthDate && <span className="flex items-center gap-1"><Calendar size={13}/>{formatDate(patient.birthDate)}</span>}
            </div>
            {patient.notes && <p className="text-sm text-surface-500 mt-2 italic">"{patient.notes}"</p>}
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="text-center px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10"><p className="text-xs text-surface-500">Pago</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</p></div>
            <div className="text-center px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10"><p className="text-xs text-surface-500">Pendente</p><p className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totalPending)}</p></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-surface-200 dark:border-surface-800 mb-6 overflow-x-auto">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`pb-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${tab===t?"text-brand-600 border-brand-600":"text-surface-500 border-transparent hover:text-foreground"}`}>{t==="timeline"?"Timeline":t==="consultas"?"Consultas":t==="prontuarios"?"Prontuários":t==="financeiro"?"Financeiro":t==="documentos"?"Documentos":"LGPD"}</button>)}
      </div>

      {/* Timeline */}
      {tab === "timeline" && (
        <div className="space-y-3 page-enter">
          {timeline.length === 0 ? <p className="text-center text-surface-500 py-8">Nenhum registro ainda</p> : timeline.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center"><div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.type==="appointment"?"bg-brand-100 dark:bg-brand-600/10":"bg-surface-100 dark:bg-surface-800"}`}>
                {item.type==="appointment" && <Clock size={14} className="text-brand-600"/>}
                {item.type==="record" && <FileText size={14} className="text-blue-500"/>}
                {item.type==="transaction" && <DollarSign size={14} className="text-emerald-500"/>}
                {item.type==="document" && <FileCheck size={14} className="text-amber-500"/>}
              </div>{i < timeline.length - 1 && <div className="w-px flex-1 bg-surface-200 dark:bg-surface-800"/>}</div>
              <div className="flex-1 pb-4">
                <p className="text-xs text-surface-500">{formatDate(item.date)}{item.time !== "00:00" ? ` às ${item.time}` : ""}</p>
                {item.type === "appointment" && <p className="text-sm font-medium">{(item.data as Appointment).type || "Consulta"} <span className={`badge ${STATUS_CONFIG[(item.data as Appointment).status]?.class} ml-1`}>{STATUS_CONFIG[(item.data as Appointment).status]?.label}</span></p>}
                {item.type === "record" && <p className="text-sm">{(item.data as ConsultationRecord).diagnosis || (item.data as ConsultationRecord).observations || "Prontuário registrado"}</p>}
                {item.type === "transaction" && <p className="text-sm">{(item.data as Transaction).description} — <span className={(item.data as Transaction).type==="receita"?"text-emerald-500":"text-red-500"}>{formatCurrency((item.data as Transaction).value)}</span></p>}
                {item.type === "document" && <p className="text-sm">{(item.data as Document).title}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "consultas" && <div className="space-y-2 page-enter">{appointments.map(a => <div key={a.id} className="glass-card p-3 flex items-center gap-3"><Clock size={14} className="text-brand-600 shrink-0"/><div className="flex-1"><p className="text-sm font-medium">{formatDate(a.date)} às {a.time}</p><p className="text-xs text-surface-500">{a.type} · {a.duration}min</p></div><span className={`badge ${STATUS_CONFIG[a.status]?.class}`}>{STATUS_CONFIG[a.status]?.label}</span></div>)}{appointments.length===0&&<p className="text-center text-surface-500 py-8">Nenhuma consulta</p>}</div>}
      {tab === "prontuarios" && <div className="space-y-2 page-enter">{records.map(r => <div key={r.id} className="glass-card p-4"><p className="text-xs text-surface-500 mb-1">{formatDate(r.date)}</p>{r.diagnosis&&<p className="text-sm font-medium mb-1">{r.diagnosis}</p>}{r.observations&&<p className="text-sm text-surface-500">{r.observations}</p>}</div>)}{records.length===0&&<p className="text-center text-surface-500 py-8">Nenhum prontuário</p>}</div>}
      {tab === "financeiro" && <div className="space-y-2 page-enter">{transactions.map(t => <div key={t.id} className="glass-card p-3 flex items-center gap-3"><DollarSign size={14} className={t.type==="receita"?"text-emerald-500":"text-red-500"}/><div className="flex-1"><p className="text-sm">{t.description||"—"}</p><p className="text-xs text-surface-500">{formatDate(t.date)}</p></div><span className={`font-medium text-sm ${t.type==="receita"?"text-emerald-600":"text-red-600"}`}>{formatCurrency(t.value)}</span></div>)}{transactions.length===0&&<p className="text-center text-surface-500 py-8">Nenhuma transação</p>}</div>}
      {tab === "documentos" && <div className="space-y-2 page-enter">{documents.map(d => <div key={d.id} className="glass-card p-3 flex items-center gap-3"><FileCheck size={14} className="text-amber-500"/><div className="flex-1"><p className="text-sm font-medium">{d.title}</p><p className="text-xs text-surface-500">{formatDate(d.date)}</p></div></div>)}{documents.length===0&&<p className="text-center text-surface-500 py-8">Nenhum documento</p>}</div>}
      {tab === "lgpd" && <div className="page-enter space-y-4">
        <div className="glass-card p-5"><h3 className="font-semibold mb-3 flex items-center gap-2"><Shield size={16} className="text-brand-600"/>Consentimentos</h3>
          {consents.length===0?<p className="text-sm text-surface-500">Nenhum consentimento registrado</p>:consents.map(c=><div key={c.id} className="flex items-center gap-3 py-2 border-b border-surface-100 dark:border-surface-800"><p className="text-sm flex-1">{c.type} — {formatDate(c.consentedAt)}</p>{c.revokedAt?<span className="badge badge-danger">Revogado</span>:<span className="badge badge-success">Ativo</span>}</div>)}
        </div>
        <div className="flex gap-3"><button onClick={exportData} className="btn-secondary flex items-center gap-2"><Download size={14}/>Exportar Dados (LGPD)</button>
        <button onClick={() => setShowDeleteAll(true)} className="btn-secondary flex items-center gap-2 text-red-500 border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={14}/>Excluir Todos os Dados</button></div>
      </div>}

      <ConfirmDialog open={showDeleteAll} title="Excluir todos os dados" description={`ATENÇÃO: Isso removerá TODOS os dados de ${patient.name} permanentemente (consultas, prontuários, documentos, financeiro). Essa ação NÃO pode ser desfeita.`} confirmLabel="Excluir Tudo"
        onConfirm={async () => { await lgpdApi.deleteAllData(id!); toast.success("Dados removidos"); setShowDeleteAll(false); window.location.href = "/pacientes"; }} onCancel={() => setShowDeleteAll(false)} />
    </MainLayout>
  );
}
