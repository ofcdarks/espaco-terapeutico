import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Users, UserCheck, PhoneOff, Clock, Copy, Check, Video } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

export default function VideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [startTime, setStartTime] = useState<number | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/telehealth/sessions/${sessionId}`);
      const data = await res.json();
      setSession(data);
    } catch {}
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { fetchSession(); const i = setInterval(fetchSession, 3000); return () => clearInterval(i); }, [fetchSession]);

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const i = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(diff / 3600)).padStart(2, "0")}:${String(Math.floor((diff % 3600) / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, [startTime]);

  const startCall = () => { setStarted(true); setStartTime(Date.now()); };

  const admitPatient = async (patientId: string) => {
    try {
      await fetch(`${API}/api/telehealth/sessions/${sessionId}/admit/${patientId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      toast.success("Paciente admitido!");
      fetchSession();
    } catch { toast.error("Erro"); }
  };

  const endSession = async () => {
    await fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, {
      method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    });
    navigate('/teleconsulta');
  };

  const patientLink = `${window.location.origin}/teleconsulta/entrar/${sessionId}`;
  const copyLink = () => { navigator.clipboard.writeText(patientLink); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Link copiado!"); };

  const waitingPatients = session?.patients?.filter((p: any) => !p.admitted) || [];
  const roomName = `espaco-${sessionId}`;
  const displayName = encodeURIComponent(user?.name || 'Terapeuta');

  // Jitsi iframe URL
  const jitsiUrl = `https://${JITSI_DOMAIN}/${roomName}#userInfo.displayName="${displayName}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.DEFAULT_BACKGROUND=%232a2523`;

  if (loading) return <div className="h-screen bg-surface-950 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full" /></div>;

  return (
    <div className="h-screen flex bg-surface-950 text-white">
      {/* Sidebar */}
      <div className="w-64 bg-surface-900 border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Sala {sessionId?.slice(0, 6)}</h2>
            <span className="text-xs font-mono text-surface-400">{elapsed}</span>
          </div>
          <button onClick={copyLink} className="w-full h-8 rounded-lg text-xs flex items-center justify-center gap-1.5 bg-white/5 border border-white/10 text-surface-300 hover:bg-white/10 transition-all">
            {copied ? <><Check size={12} className="text-emerald-400" /> Copiado</> : <><Copy size={12} /> Link do paciente</>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={12} /> Sala de espera ({waitingPatients.length})
          </p>
          {waitingPatients.length === 0 ? (
            <p className="text-xs text-surface-600 text-center py-6">Nenhum paciente aguardando</p>
          ) : waitingPatients.map((p: any) => (
            <div key={p.id} className="bg-white/5 rounded-xl p-3 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-[10px] text-surface-500">
                    {new Date(p.joinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button onClick={() => admitPatient(p.id)}
                  className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all"
                  title="Admitir">
                  <UserCheck size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-white/5 space-y-2">
          {!started && (
            <button onClick={startCall} className="w-full h-10 rounded-xl bg-brand-600 dark:bg-brand-300 dark:text-brand-900 text-white font-medium text-sm flex items-center justify-center gap-2">
              <Video size={16} /> Iniciar Chamada
            </button>
          )}
          <button onClick={endSession} className="w-full h-9 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-all">
            <PhoneOff size={14} /> Encerrar
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1">
        {!started ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-brand-500/20 flex items-center justify-center mb-6">
              <Clock size={32} className="text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sala pronta</h2>
            <p className="text-surface-400 text-sm mb-6 max-w-md">
              Envie o link para seu paciente e clique em "Iniciar Chamada" quando estiver pronto.
            </p>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3 max-w-md w-full">
              <code className="flex-1 text-xs text-surface-400 truncate">{patientLink}</code>
              <button onClick={copyLink} className="text-brand-400 hover:text-brand-300">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <iframe
            src={jitsiUrl}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            allowFullScreen
            className="w-full h-full border-0"
            title="Teleconsulta"
          />
        )}
      </div>
    </div>
  );
}
