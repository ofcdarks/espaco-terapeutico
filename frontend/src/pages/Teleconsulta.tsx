import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, Modal, EmptyState, LoadingState } from "@/components/common";
import { useAppointments, usePatients } from "@/hooks/useData";
import { Video, Copy, Check, Users, Clock, UserCheck, ExternalLink, Plus, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import type { Appointment } from "@/types";

const API = import.meta.env.VITE_API_URL || '';

export default function Teleconsulta() {
  const { data: appointments } = useAppointments();
  const { data: patients } = usePatients();
  const [sessions, setSessions] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selectedApt, setSelectedApt] = useState("");

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API}/api/telehealth/my-sessions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      if (res.ok) setSessions(await res.json());
    } catch {}
  };

  useEffect(() => { fetchSessions(); const i = setInterval(fetchSessions, 5000); return () => clearInterval(i); }, []);

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/api/telehealth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify({ appointmentId: selectedApt || undefined }),
      });
      const data = await res.json();
      toast.success("Sala criada!");
      setShowNew(false);
      fetchSessions();
      // Open in new tab
      window.open(data.hostUrl, '_blank');
    } catch { toast.error("Erro ao criar sala"); }
    setCreating(false);
  };

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopied(id);
    setTimeout(() => setCopied(""), 2000);
    toast.success("Link copiado!");
  };

  const endSession = async (sessionId: string) => {
    await fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    });
    fetchSessions();
    toast.success("Sessão encerrada");
  };

  const todayAppts = appointments.filter(a =>
    a.date === new Date().toISOString().split("T")[0] && !['concluido','cancelado'].includes(a.status)
  );

  return (
    <MainLayout>
      <PageHeader title="Teleconsulta" subtitle="Sessões de vídeo em tempo real" action={{ label: "Nova Sala", onClick: () => setShowNew(true) }} />

      {/* Active sessions */}
      {sessions.length > 0 && (
        <div className="mb-8 page-enter">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Salas ativas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map(s => (
              <div key={s.sessionId} className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Video size={18} className="text-emerald-500" />
                    <span className="font-semibold">Sala {s.sessionId}</span>
                  </div>
                  <span className={`badge ${s.status === 'in_session' ? 'badge-success' : 'badge-warning'}`}>
                    {s.status === 'in_session' ? 'Em sessão' : 'Aguardando'}
                  </span>
                </div>
                {s.patientsWaiting > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-3">
                    <Users size={14} /> {s.patientsWaiting} paciente(s) na sala de espera
                  </div>
                )}
                <div className="flex gap-2">
                  <a href={`/teleconsulta/sala/${s.sessionId}`} target="_blank" rel="noopener"
                    className="btn-primary flex items-center gap-1.5 text-xs h-8">
                    <Video size={14} /> Entrar
                  </a>
                  <button onClick={() => copyLink(`/teleconsulta/entrar/${s.sessionId}`, s.sessionId)}
                    className="btn-secondary flex items-center gap-1.5 text-xs h-8">
                    {copied === s.sessionId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    Link paciente
                  </button>
                  <button onClick={() => endSession(s.sessionId)}
                    className="btn-ghost text-xs h-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                    <PhoneOff size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's appointments quick-start */}
      {todayAppts.length > 0 && (
        <div className="mb-8 page-enter">
          <h3 className="text-sm font-semibold mb-3">Consultas de hoje — iniciar teleconsulta</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {todayAppts.map(a => (
              <div key={a.id} className="glass-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.patientName}</p>
                  <p className="text-xs text-surface-500">{a.time} · {a.duration}min</p>
                </div>
                <button onClick={() => { setSelectedApt(a.id); setShowNew(true); }}
                  className="btn-primary h-8 text-xs flex items-center gap-1">
                  <Video size={12} /> Iniciar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && todayAppts.length === 0 && (
        <EmptyState icon={Video} title="Nenhuma sala ativa"
          description="Crie uma sala de teleconsulta para atender seus pacientes por vídeo. O paciente recebe um link e entra pela sala de espera."
          action={{ label: "Nova Sala", onClick: () => setShowNew(true) }} />
      )}

      {/* Info */}
      <div className="glass-card p-6 mt-8 page-enter">
        <h3 className="font-semibold mb-3">Como funciona</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-surface-600 dark:text-surface-400">
          <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center shrink-0 text-brand-600 font-bold text-xs">1</div>
            <div><p className="font-medium text-foreground">Crie a sala</p><p className="text-xs mt-0.5">Clique em "Nova Sala" e opcionalmente vincule a uma consulta.</p></div></div>
          <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center shrink-0 text-brand-600 font-bold text-xs">2</div>
            <div><p className="font-medium text-foreground">Envie o link</p><p className="text-xs mt-0.5">Copie o link do paciente e envie por WhatsApp ou email.</p></div></div>
          <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center shrink-0 text-brand-600 font-bold text-xs">3</div>
            <div><p className="font-medium text-foreground">Admita e atenda</p><p className="text-xs mt-0.5">O paciente espera na sala de espera. Você admite e a videochamada inicia.</p></div></div>
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nova Sala de Teleconsulta" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1 block">Vincular a consulta (opcional)</label>
            <select value={selectedApt} onChange={e => setSelectedApt(e.target.value)} className="input-premium w-full">
              <option value="">Nenhuma — sala avulsa</option>
              {todayAppts.map(a => <option key={a.id} value={a.id}>{a.time} — {a.patientName}</option>)}
            </select>
          </div>
          <p className="text-xs text-surface-500">A sala usa Jitsi Meet (gratuito, sem cadastro). Vídeo, áudio, chat e compartilhamento de tela inclusos.</p>
          <button onClick={createSession} disabled={creating} className="btn-primary w-full h-11">
            {creating ? "Criando..." : "Criar Sala e Entrar"}
          </button>
        </div>
      </Modal>
    </MainLayout>
  );
}
