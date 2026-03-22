import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader, EmptyState } from "@/components/common";
import { useNavigate } from "react-router-dom";
import { Video, Copy, Check, Trash2, ExternalLink, Plus, Clock, Users } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}`, 'Content-Type': 'application/json' });

export default function Teleconsulta() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState("");
  const nav = useNavigate();

  const refresh = async () => {
    try {
      const r = await fetch(`${API}/api/telehealth/my-sessions`, { headers: auth() });
      const d = await r.json();
      setSessions(d || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); const i = setInterval(refresh, 5000); return () => clearInterval(i); }, []);

  const createRoom = async () => {
    const r = await fetch(`${API}/api/telehealth/sessions`, { method: 'POST', headers: auth() });
    const d = await r.json();
    toast.success("Sala criada!");
    refresh();
  };

  const endSession = async (id: string) => {
    await fetch(`${API}/api/telehealth/sessions/${id}/end`, { method: 'POST', headers: auth() });
    toast.success("Sessão encerrada"); refresh();
  };

  const copyLink = (id: string, type: 'patient' | 'pro') => {
    const link = type === 'patient' 
      ? `${window.location.origin}/teleconsulta/entrar/${id}`
      : `${window.location.origin}/teleconsulta/sala/${id}`;
    navigator.clipboard.writeText(link);
    setCopied(`${id}-${type}`);
    setTimeout(() => setCopied(""), 2000);
    toast.success(type === 'patient' ? "Link do paciente copiado!" : "Link do profissional copiado!");
  };

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

      {sessions.length === 0 ? (
        <EmptyState icon={Video} title="Nenhuma sala" description="Crie uma sala de teleconsulta para atender seus pacientes" action={{ label: "Nova Sala", onClick: createRoom }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 page-enter">
          {sessions.map(s => (
            <div key={s.id} className="glass-card overflow-hidden">
              <div className="p-4 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-600/10 flex items-center justify-center">
                      <Video size={14} className="text-brand-600 dark:text-brand-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.id?.slice(0, 8)}</p>
                      <p className="text-[10px] text-surface-500">Sala de Reunião</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-surface-100 text-surface-500 dark:bg-surface-800'}`}>
                    {s.status === 'active' ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>
                <p className="text-[10px] text-surface-400">{new Date(s.createdAt || Date.now()).toLocaleString('pt-BR')}</p>
                {s.patients?.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <Users size={10} className="text-surface-400" />
                    <span className="text-[10px] text-surface-500">{s.patients.length} participante(s)</span>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => copyLink(s.id, 'patient')}
                    className="h-8 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 bg-brand-600 text-white dark:bg-brand-300 dark:text-brand-900">
                    {copied === `${s.id}-patient` ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Link Paciente</>}
                  </button>
                  <button onClick={() => copyLink(s.id, 'pro')}
                    className="h-8 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 border" style={{ borderColor: 'hsl(var(--border))' }}>
                    {copied === `${s.id}-pro` ? <><Check size={10} /> Copiado</> : <><Copy size={10} /> Link Profissional</>}
                  </button>
                </div>
                <button onClick={() => nav(`/teleconsulta/sala/${s.id}`)}
                  className="w-full h-8 rounded-lg text-[11px] flex items-center justify-center gap-1.5 border text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-600/5 transition-all" style={{ borderColor: 'hsl(var(--border))' }}>
                  <ExternalLink size={10} /> Entrar como profissional
                </button>
                {s.status === 'active' && (
                  <button onClick={() => endSession(s.id)}
                    className="w-full h-7 rounded-lg text-[10px] flex items-center justify-center gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/5 transition-all">
                    <Trash2 size={10} /> Encerrar Sala
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
}
