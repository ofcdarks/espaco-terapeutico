import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Clock, Video, Loader2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';
const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState<'name' | 'waiting' | 'video' | 'ended' | 'error'>('name');
  const [name, setName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [position, setPosition] = useState(0);
  const [jitsiRoom, setJitsiRoom] = useState('');
  const jitsiRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  // Join waiting room
  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/telehealth/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.error?.includes('encerrada')) setStep('ended');
        else setStep('error');
        return;
      }
      const data = await res.json();
      setPatientId(data.patientId);
      setPosition(data.position);
      setStep('waiting');
    } catch { setStep('error'); }
  };

  // Poll for admission
  useEffect(() => {
    if (step !== 'waiting' || !patientId) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/telehealth/sessions/${sessionId}/status/${patientId}`);
        const data = await res.json();
        if (data.ended) { setStep('ended'); clearInterval(poll); }
        else if (data.admitted && data.jitsiRoom) {
          setJitsiRoom(data.jitsiRoom);
          setStep('video');
          clearInterval(poll);
        } else {
          setPosition(data.position);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [step, patientId, sessionId]);

  // Start Jitsi when admitted
  useEffect(() => {
    if (step !== 'video' || !jitsiRef.current || apiRef.current) return;
    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.onload = () => {
      apiRef.current = new (window as any).JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: jitsiRoom,
        parentNode: jitsiRef.current!,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          toolbarButtons: ['microphone', 'camera', 'chat', 'raisehand', 'tileview', 'fullscreen'],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          DEFAULT_BACKGROUND: '#0f0f12',
          TOOLBAR_ALWAYS_VISIBLE: true,
        },
        userInfo: { displayName: name },
      });
      apiRef.current.addListener('readyToClose', () => setStep('ended'));
    };
    document.head.appendChild(script);
  }, [step, jitsiRoom, name]);

  // ── Name input ─────────────────────────────────────
  if (step === 'name') return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center mx-auto mb-6">
          <Video size={28} className="text-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Teleconsulta</h1>
        <p className="text-surface-400 text-sm mb-8">Informe seu nome para entrar na sala de espera</p>
        <form onSubmit={joinRoom} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            placeholder="Seu nome completo" required autoFocus />
          <button type="submit" className="w-full h-12 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium transition-all">
            Entrar na Sala de Espera
          </button>
        </form>
        <p className="text-xs text-surface-600 mt-6">Sua câmera e microfone serão solicitados quando a consulta iniciar.</p>
      </div>
    </div>
  );

  // ── Waiting ────────────────────────────────────────
  if (step === 'waiting') return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 relative">
          <Clock size={32} className="text-amber-400" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{position}</div>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Sala de Espera</h1>
        <p className="text-surface-400 text-sm mb-2">Olá, <span className="text-white font-medium">{name}</span>!</p>
        <p className="text-surface-500 text-sm mb-8">Aguarde o profissional admitir você na consulta.</p>
        <div className="flex items-center justify-center gap-2 text-surface-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Aguardando...</span>
        </div>
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5 max-w-xs mx-auto">
          <p className="text-xs text-surface-500">Dicas para uma boa sessão:</p>
          <ul className="text-xs text-surface-400 mt-2 space-y-1 text-left">
            <li>• Escolha um local tranquilo e bem iluminado</li>
            <li>• Use fones de ouvido se possível</li>
            <li>• Verifique sua conexão de internet</li>
            <li>• Feche apps desnecessários</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // ── Video (admitted) ───────────────────────────────
  if (step === 'video') return (
    <div className="h-screen bg-surface-950">
      <div ref={jitsiRef} className="h-full w-full" />
    </div>
  );

  // ── Ended ──────────────────────────────────────────
  if (step === 'ended') return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Video size={28} className="text-emerald-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">Sessão encerrada</h1>
        <p className="text-surface-400 text-sm">Obrigado pela sua participação. Você pode fechar esta janela.</p>
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-white mb-2">Sessão não encontrada</h1>
        <p className="text-surface-400 text-sm">Verifique o link com seu terapeuta.</p>
      </div>
    </div>
  );
}
