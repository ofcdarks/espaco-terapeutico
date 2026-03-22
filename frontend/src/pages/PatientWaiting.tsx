import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Clock, Video, Loader2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';
const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [step, setStep] = useState<'name' | 'waiting' | 'video' | 'ended' | 'error'>('name');
  const [name, setName] = useState('');
  const [patientId, setPatientId] = useState('');

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/telehealth/sessions/${sessionId}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) { setStep('error'); return; }
      const data = await res.json();
      setPatientId(data.patientId);
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
        else if (data.admitted) { setStep('video'); clearInterval(poll); }
      } catch {}
    }, 2000);
    return () => clearInterval(poll);
  }, [step, patientId, sessionId]);

  const roomName = `espaco-${sessionId}`;
  const displayName = encodeURIComponent(name);
  const jitsiUrl = `https://${JITSI_DOMAIN}/${roomName}#userInfo.displayName="${displayName}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false`;

  if (step === 'name') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#2a2523' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.2)' }}>
          <Video size={28} style={{ color: '#c4a882' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>Teleconsulta</h1>
        <p className="text-sm mb-8" style={{ color: '#b8b0aa' }}>Informe seu nome para entrar na sala de espera</p>
        <form onSubmit={joinRoom} className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full h-12 rounded-xl px-4 text-sm focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8d8c3' }}
            placeholder="Seu nome completo" required autoFocus />
          <button type="submit" className="w-full h-12 rounded-xl font-medium text-sm transition-all"
            style={{ background: '#54423b', color: '#f5f2ee' }}>
            Entrar na Sala de Espera
          </button>
        </form>
      </div>
    </div>
  );

  if (step === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#2a2523' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.1)' }}>
          <Clock size={32} style={{ color: '#c4a882' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>Sala de Espera</h1>
        <p className="text-sm mb-2" style={{ color: '#b8b0aa' }}>Olá, <span style={{ color: '#e8d8c3', fontWeight: 500 }}>{name}</span>!</p>
        <p className="text-sm mb-8" style={{ color: '#b8b0aa' }}>Aguarde o profissional admitir você.</p>
        <Loader2 size={20} className="animate-spin mx-auto" style={{ color: '#c4a882' }} />
        <div className="mt-8 p-4 rounded-xl max-w-xs mx-auto text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-xs mb-2" style={{ color: '#b8b0aa' }}>Dicas:</p>
          <ul className="text-xs space-y-1" style={{ color: '#8b7f77' }}>
            <li>• Local tranquilo e bem iluminado</li>
            <li>• Use fones de ouvido</li>
            <li>• Feche apps desnecessários</li>
          </ul>
        </div>
      </div>
    </div>
  );

  if (step === 'video') return (
    <div className="h-screen" style={{ background: '#2a2523' }}>
      <iframe src={jitsiUrl} allow="camera; microphone; display-capture; autoplay; clipboard-write"
        allowFullScreen className="w-full h-full border-0" title="Teleconsulta" />
    </div>
  );

  if (step === 'ended') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <Video size={28} style={{ color: '#54423b' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Sessão encerrada</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>Obrigado. Você pode fechar esta janela.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Sessão não encontrada</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>Verifique o link com seu terapeuta.</p>
      </div>
    </div>
  );
}
