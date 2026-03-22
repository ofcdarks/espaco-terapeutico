import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/common";
import { Users, UserCheck, PhoneOff, Clock, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

export default function VideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const jitsiRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const startTimeRef = useRef<Date | null>(null);

  // Fetch session + poll waiting room
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/telehealth/sessions/${sessionId}`);
      const data = await res.json();
      setSession(data);
      setLoading(false);
    } catch { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { fetchSession(); const i = setInterval(fetchSession, 3000); return () => clearInterval(i); }, [fetchSession]);

  // Timer
  useEffect(() => {
    if (!started) return;
    startTimeRef.current = new Date();
    const i = setInterval(() => {
      if (!startTimeRef.current) return;
      const diff = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(i);
  }, [started]);

  // Initialize Jitsi
  const startJitsi = useCallback(() => {
    if (!jitsiRef.current || !sessionId || apiRef.current) return;

    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.onload = () => {
      apiRef.current = new (window as any).JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: `espaco-${sessionId}`,
        parentNode: jitsiRef.current!,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableModeratorIndicator: true,
          enableClosePage: false,
          toolbarButtons: [
            'microphone', 'camera', 'desktop', 'chat', 'raisehand',
            'tileview', 'fullscreen', 'settings',
          ],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          DEFAULT_BACKGROUND: '#0f0f12',
          TOOLBAR_ALWAYS_VISIBLE: true,
        },
        userInfo: { displayName: user?.name || 'Terapeuta' },
      });

      apiRef.current.addListener('readyToClose', () => endSession());
      setStarted(true);
    };
    document.head.appendChild(script);
  }, [sessionId, user]);

  const admitPatient = async (patientId: string) => {
    try {
      await fetch(`${API}/api/telehealth/sessions/${sessionId}/admit/${patientId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      toast.success("Paciente admitido!");
      fetchSession();
    } catch { toast.error("Erro"); }
  };

  const endSession = async () => {
    await fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    });
    apiRef.current?.dispose();
    navigate('/teleconsulta');
  };

  const patientLink = `${window.location.origin}/teleconsulta/entrar/${sessionId}`;
  const copyLink = () => { navigator.clipboard.writeText(patientLink); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const waitingPatients = session?.patients?.filter((p: any) => !p.admitted) || [];

  if (loading) return <LoadingState />;
  if (!session?.exists) return <div className="h-screen flex items-center justify-center"><p className="text-surface-500">Sessão não encontrada</p></div>;

  return (
    <div className="h-screen flex bg-surface-950 text-white">
      {/* Sidebar - waiting room */}
      <div className="w-72 bg-surface-900 border-r border-white/5 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Sala {sessionId}</h2>
            <span className="text-xs font-mono text-surface-400">{elapsed}</span>
          </div>
          <button onClick={copyLink} className="w-full btn-secondary text-xs h-8 flex items-center justify-center gap-1.5 !bg-white/5 !border-white/10 !text-surface-300">
            {copied ? <><Check size={12} className="text-emerald-400" /> Copiado</> : <><Copy size={12} /> Link do paciente</>}
          </button>
        </div>

        {/* Waiting room */}
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
                  <p className="text-[10px] text-surface-500">Aguardando desde {new Date(p.joinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <button onClick={() => admitPatient(p.id)}
                  className="w-8 h-8 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all"
                  title="Admitir paciente" aria-label={`Admitir ${p.name}`}>
                  <UserCheck size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="p-3 border-t border-white/5 space-y-2">
          {!started && (
            <button onClick={startJitsi} className="w-full btn-primary h-10 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" /> Iniciar Videochamada
            </button>
          )}
          <button onClick={endSession} className="w-full h-9 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-all">
            <PhoneOff size={14} /> Encerrar Sessão
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative">
        {!started ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-brand-500/20 flex items-center justify-center mb-6">
              <Clock size={32} className="text-brand-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Sala pronta</h2>
            <p className="text-surface-400 text-sm mb-6 max-w-md">
              Envie o link para seu paciente. Quando ele entrar na sala de espera, você verá na lateral esquerda. Clique em "Iniciar Videochamada" quando estiver pronto.
            </p>
            <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3 max-w-md w-full">
              <code className="flex-1 text-xs text-surface-400 truncate">{patientLink}</code>
              <button onClick={copyLink} className="text-brand-400 hover:text-brand-300 transition-colors">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        ) : (
          <div ref={jitsiRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
}
