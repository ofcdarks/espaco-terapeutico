import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Video, Loader2 } from "lucide-react";
const JITSI = 'meet.jit.si';

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const jitsiUrl = `https://${JITSI}/espaco-${sessionId}`;

  useEffect(() => { const t = setTimeout(() => { window.location.href = jitsiUrl; }, 1500); return () => clearTimeout(t); }, [jitsiUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#2a2523' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.2)' }}><Video size={28} style={{ color: '#c4a882' }} /></div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>Entrando na sala...</h1>
        <Loader2 size={24} className="animate-spin mx-auto mb-4" style={{ color: '#c4a882' }} />
        <p className="text-xs" style={{ color: '#6b5f57' }}>Não redirecionou? <a href={jitsiUrl} style={{ color: '#c4a882' }} className="underline">Clique aqui</a></p>
      </div>
    </div>
  );
}
