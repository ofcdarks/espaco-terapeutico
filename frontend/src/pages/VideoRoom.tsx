import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneOff, Copy, Check, Video, Clock } from "lucide-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || '';
const JITSI = 'meet.jit.si';

export default function VideoRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState("00:00");
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (!startTime) return;
    const i = setInterval(() => {
      const d = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, [startTime]);

  const room = `espaco-${sessionId}`;
  const name = encodeURIComponent(user?.name || 'Terapeuta');
  const jitsiUrl = `https://${JITSI}/${room}#userInfo.displayName="${name}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.SHOW_JITSI_WATERMARK=false&interfaceConfig.SHOW_BRAND_WATERMARK=false&interfaceConfig.DEFAULT_BACKGROUND=%231a1412`;

  const patientLink = `https://${JITSI}/${room}`;
  const copyLink = () => { navigator.clipboard.writeText(patientLink); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success("Link copiado! Envie ao paciente."); };

  const startCall = () => { setStarted(true); setStartTime(Date.now()); };
  const endCall = () => {
    fetch(`${API}/api/telehealth/sessions/${sessionId}/end`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }).catch(() => {});
    nav('/teleconsulta');
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1a1412' }}>
      <div className="h-12 flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#54423b' }}><span className="text-[10px] font-bold" style={{ color: '#e8d8c3' }}>ET</span></div>
          <span className="text-sm font-medium" style={{ color: '#e8d8c3' }}>Teleconsulta</span>
          {started && <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(46,125,50,0.15)', color: '#81c784' }}>{elapsed}</span>}
        </div>
        <button onClick={copyLink} className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.05)', color: '#b8b0aa' }}>
          {copied ? <><Check size={12} style={{ color: '#81c784' }} /> Copiado</> : <><Copy size={12} /> Copiar link</>}
        </button>
      </div>
      <div className="flex-1">
        {!started ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8" style={{ background: 'rgba(84,66,59,0.2)' }}><Video size={40} style={{ color: '#c4a882' }} /></div>
            <h2 className="text-2xl font-semibold mb-3" style={{ color: '#e8d8c3' }}>Sala de Teleconsulta</h2>
            <p className="text-sm mb-2 max-w-md" style={{ color: '#8b7f77' }}>Copie o link e envie ao paciente por WhatsApp.</p>
            <p className="text-xs mb-6 max-w-md" style={{ color: '#6b5f57' }}>O paciente clica e entra direto — sem cadastro, sem download.</p>
            <div className="flex items-center gap-2 rounded-xl p-3 max-w-lg w-full mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <code className="flex-1 text-xs truncate" style={{ color: '#8b7f77' }}>{patientLink}</code>
              <button onClick={copyLink} style={{ color: '#c4a882' }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
            <button onClick={startCall} className="h-12 px-8 rounded-xl font-medium text-sm flex items-center gap-2" style={{ background: '#54423b', color: '#f5f2ee' }}><Video size={18} /> Iniciar Chamada</button>
          </div>
        ) : (
          <iframe src={jitsiUrl} allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen" allowFullScreen className="w-full h-full border-0" title="Teleconsulta" />
        )}
      </div>
      {started && (
        <div className="h-16 flex items-center justify-center shrink-0" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={endCall} className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#c62828', color: 'white' }}><PhoneOff size={22} /></button>
        </div>
      )}
    </div>
  );
}
