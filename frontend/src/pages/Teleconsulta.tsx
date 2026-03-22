import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, EmptyState, Modal } from "@/components/common";
import { useNavigate } from "react-router-dom";
import { Video, Copy, Check, Trash2, ExternalLink, Plus, Users, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function Teleconsulta() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const [newRoom, setNewRoom] = useState<any>(null);
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const r = await fetch(`${API}/api/telehealth/my-sessions`, { headers: auth() });
      const d = await r.json();
      setSessions(Array.isArray(d) ? d : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); const i = setInterval(refresh, 8000); return () => clearInterval(i); }, []);

  const createRoom = async () => {
    const r = await fetch(`${API}/api/telehealth/sessions`, { method: 'POST', headers: auth(), body: JSON.stringify({}) });
    const d = await r.json();
    setNewRoom(d);
    refresh();
  };

  const endSession = async (id: string) => {
    await fetch(`${API}/api/telehealth/sessions/${id}/end`, { method: 'POST', headers: auth() });
    toast.success("Sessão encerrada"); refresh();
  };

  const copyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopied(id); setTimeout(() => setCopied(""), 2000);
    toast.success("Link copiado!");
  };

  const patientLink = (id: string) => `${window.location.origin}/teleconsulta/entrar/${id}`;
  const proLink = (id: string) => `${window.location.origin}/teleconsulta/sala/${id}`;

  return (
    <MainLayout>
      <div className="glass-card p-6 mb-6 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #54423b, #3d302a)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center"><Video size={24} className="text-white" /></div>
          <div><h1 className="text-lg font-semibold text-white">Teleconsulta</h1><p className="text-sm text-white/60">Gerencie suas salas de videochamada</p></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/80">{sessions.length} salas</span>
          <button onClick={createRoom} className="h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-2 bg-white text-brand-800">
            <Plus size={14} /> Nova Sala
          </button>
        </div>
      </div>

      {/* Room created modal */}
      <Modal open={!!newRoom} onClose={() => setNewRoom(null)} title="" size="sm">
        {newRoom && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Sala Criada com Sucesso!</h2>
            <p className="text-xs text-surface-500 mb-5">Sua nova sala de reunião está pronta.</p>

            <div className="text-left space-y-4">
              <div>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Código da Sala</p>
                <p className="text-lg font-bold text-brand-600 dark:text-brand-300">{newRoom.sessionId}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-700">
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Link do Paciente</p>
                <code className="text-xs break-all text-surface-600 dark:text-surface-400">{patientLink(newRoom.sessionId)}</code>
                <p className="text-[9px] text-surface-400 mt-1 italic">Envie este link para o paciente acessar a sala</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => copyLink(patientLink(newRoom.sessionId), 'new-patient')}
                className="h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 bg-brand-600 text-white dark:bg-brand-300 dark:text-brand-900">
                {copied === 'new-patient' ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Link do Paciente</>}
              </button>
              <button onClick={() => copyLink(proLink(newRoom.sessionId), 'new-pro')}
                className="h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 border border-brand-600 text-brand-600 dark:border-brand-300 dark:text-brand-300">
                {copied === 'new-pro' ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Link Profissional</>}
              </button>
            </div>

            <button onClick={() => { setNewRoom(null); nav(`/teleconsulta/sala/${newRoom.sessionId}`); }}
              className="w-full h-9 mt-3 rounded-xl text-xs text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-600/5 transition-all flex items-center justify-center gap-1.5">
              <ExternalLink size={12} /> Entrar na sala agora
            </button>

            <button onClick={() => setNewRoom(null)} className="text-xs text-surface-400 mt-3 hover:text-surface-600">Fechar</button>
          </div>
        )}
      </Modal>

      {sessions.length === 0 ? (
        <EmptyState icon={Video} title="Nenhuma sala" description="Crie uma sala de teleconsulta para atender seus pacientes" action={{ label: "Nova Sala", onClick: createRoom }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 page-enter">
          {sessions.map(s => (
            <div key={s.sessionId} className="glass-card overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center">
                      <Video size={14} className="text-brand-600 dark:text-brand-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.sessionId}</p>
                      <p className="text-[10px] text-surface-500">Sala de Reunião</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'active' || s.status === 'waiting' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-surface-100 text-surface-500 dark:bg-surface-800'}`}>
                    {s.status === 'active' || s.status === 'waiting' ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>
                <p className="text-[10px] text-surface-400">{new Date(s.createdAt || Date.now()).toLocaleString('pt-BR')}</p>
                {s.patientsWaiting > 0 && (
                  <div className="flex items-center gap-1 mt-2 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/5">
                    <Users size={10} className="text-amber-600" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">{s.patientsWaiting} aguardando</span>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => copyLink(patientLink(s.sessionId), `${s.sessionId}-p`)}
                    className="h-8 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 bg-brand-600 text-white dark:bg-brand-300 dark:text-brand-900">
                    {copied === `${s.sessionId}-p` ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Link Paciente</>}
                  </button>
                  <button onClick={() => copyLink(proLink(s.sessionId), `${s.sessionId}-pro`)}
                    className="h-8 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 border" style={{ borderColor: 'hsl(var(--border))' }}>
                    {copied === `${s.sessionId}-pro` ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Link Profissional</>}
                  </button>
                </div>
                <button onClick={() => nav(`/teleconsulta/sala/${s.sessionId}`)}
                  className="w-full h-8 rounded-lg text-[11px] flex items-center justify-center gap-1.5 border text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-600/5 transition-all" style={{ borderColor: 'hsl(var(--border))' }}>
                  <ExternalLink size={10} /> Entrar como profissional
                </button>
                <button onClick={() => endSession(s.sessionId)}
                  className="w-full h-7 rounded-lg text-[10px] flex items-center justify-center gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all">
                  <Trash2 size={10} /> Encerrar Sala
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
