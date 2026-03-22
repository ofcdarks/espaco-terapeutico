import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Check, FileText, Clock, Loader2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';

export default function Portal() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"appointments"|"documents">("appointments");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/api/portal/${token}/info`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API}/api/portal/${token}/appointments`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/portal/${token}/documents`).then(r => r.ok ? r.json() : []),
    ]).then(([i, a, d]) => { setInfo(i); setAppointments(a); setDocuments(d); })
      .catch(() => setError("Link inválido ou expirado"))
      .finally(() => setLoading(false));
  }, [token]);

  const confirm = async (aptId: string) => {
    await fetch(`${API}/api/portal/${token}/confirm/${aptId}`, { method: 'POST' });
    setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: 'confirmado' } : a));
  };

  if (loading) return <div className="min-h-screen bg-surface-950 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
  if (error) return <div className="min-h-screen bg-surface-950 flex items-center justify-center text-center"><div><AlertCircle size={40} className="text-red-400 mx-auto mb-4" /><h1 className="text-xl font-semibold text-white">{error}</h1><p className="text-surface-400 text-sm mt-2">Solicite um novo link ao seu terapeuta.</p></div></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-surface-200 dark:border-surface-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center"><span className="text-white font-bold text-[10px]">ET</span></div>
          <div><p className="text-sm font-semibold">Espaço Terapêutico</p><p className="text-xs text-surface-500">Portal do Paciente — {info?.name}</p></div>
        </div>
      </header>
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex gap-4 border-b border-surface-200 dark:border-surface-800 mb-6">
          <button onClick={() => setTab("appointments")} className={`pb-3 text-sm font-medium border-b-2 transition-all ${tab==="appointments"?"text-brand-600 border-brand-600":"text-surface-500 border-transparent"}`}>Consultas</button>
          <button onClick={() => setTab("documents")} className={`pb-3 text-sm font-medium border-b-2 transition-all ${tab==="documents"?"text-brand-600 border-brand-600":"text-surface-500 border-transparent"}`}>Documentos</button>
        </div>
        {tab === "appointments" && (
          <div className="space-y-3">
            {appointments.length === 0 ? <p className="text-center text-surface-500 py-8">Nenhuma consulta futura</p> : appointments.map(a => (
              <div key={a.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-600/10 flex flex-col items-center justify-center shrink-0">
                  <Calendar size={14} className="text-brand-600" />
                  <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-300">{a.date?.split("-").slice(1).reverse().join("/")}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.date?.split("-").reverse().join("/")} às {a.time}</p>
                  <p className="text-xs text-surface-500">{a.type || "Consulta"} · {a.duration}min</p>
                </div>
                {a.status === "agendado" ? (
                  <button onClick={() => confirm(a.id)} className="btn-primary h-8 text-xs flex items-center gap-1"><Check size={12} /> Confirmar</button>
                ) : (
                  <span className={`badge ${a.status==="confirmado"?"badge-success":"badge-neutral"}`}>{a.status==="confirmado"?"Confirmado":a.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === "documents" && (
          <div className="space-y-3">
            {documents.length === 0 ? <p className="text-center text-surface-500 py-8">Nenhum documento</p> : documents.map(d => (
              <div key={d.id} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2"><FileText size={14} className="text-amber-500" /><p className="text-sm font-medium">{d.title}</p></div>
                <p className="text-xs text-surface-500 mb-2">{d.date?.split("-").reverse().join("/")}</p>
                <p className="text-sm text-surface-600 dark:text-surface-400 whitespace-pre-wrap">{d.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
