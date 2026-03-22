import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Check, FileText, Loader2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';

export default function Portal() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"appointments" | "documents">("appointments");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/api/portal/${token}/info`).then(r => r.ok ? r.json() : Promise.reject('expired')),
      fetch(`${API}/api/portal/${token}/appointments`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/portal/${token}/documents`).then(r => r.ok ? r.json() : []),
    ]).then(([info, appts, docs]) => {
      setInfo(info); setAppointments(appts); setDocuments(docs);
    }).catch(() => setError("Link expirado ou inválido")).finally(() => setLoading(false));
  }, [token]);

  const confirmAppt = async (id: string) => {
    await fetch(`${API}/api/portal/${token}/confirm/${id}`, { method: 'POST' });
    toast.success("Consulta confirmada!"); 
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmado' } : a));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f2ee' }}><Loader2 className="animate-spin" style={{ color: '#54423b' }} /></div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center"><AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Link inválido</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>{error}</p></div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f5f2ee' }}>
      <div className="max-w-2xl mx-auto p-4 pt-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#54423b' }}><span className="text-white font-bold text-sm">ET</span></div>
          <h1 className="text-xl font-semibold" style={{ color: '#2a2523' }}>Olá, {info?.name}!</h1>
          <p className="text-sm" style={{ color: '#b8b0aa' }}>Seu portal de acompanhamento</p>
        </div>

        <div className="flex gap-2 mb-6 justify-center">
          {[{ id: 'appointments' as const, label: 'Consultas', icon: Calendar }, { id: 'documents' as const, label: 'Documentos', icon: FileText }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: tab === t.id ? '#54423b' : 'white', color: tab === t.id ? '#f5f2ee' : '#54423b', border: '1px solid #e8d8c3' }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'appointments' && (
          <div className="space-y-3">
            {appointments.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
                <Calendar size={24} style={{ color: '#b8b0aa' }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: '#b8b0aa' }}>Nenhuma consulta agendada</p>
              </div>
            ) : appointments.map(a => (
              <div key={a.id} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f5f2ee' }}>
                    <Clock size={16} style={{ color: '#54423b' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2a2523' }}>{new Date(a.date + 'T12:00').toLocaleDateString('pt-BR')} às {a.time}</p>
                    <p className="text-xs" style={{ color: '#b8b0aa' }}>{a.duration}min · {a.type || 'Consulta'}</p>
                  </div>
                </div>
                {a.status === 'confirmado' ? (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Confirmado</span>
                ) : (
                  <button onClick={() => confirmAppt(a.id)} className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1" style={{ background: '#54423b', color: '#f5f2ee' }}>
                    <Check size={12} /> Confirmar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'documents' && (
          <div className="space-y-3">
            {documents.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
                <FileText size={24} style={{ color: '#b8b0aa' }} className="mx-auto mb-2" />
                <p className="text-sm" style={{ color: '#b8b0aa' }}>Nenhum documento disponível</p>
              </div>
            ) : documents.map(d => (
              <div key={d.id} className="p-4 rounded-2xl" style={{ background: 'white', border: '1px solid #e8d8c3' }}>
                <p className="text-sm font-medium" style={{ color: '#2a2523' }}>{d.title}</p>
                <p className="text-xs mt-1" style={{ color: '#b8b0aa' }}>{d.type} · {new Date(d.date + 'T12:00').toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
