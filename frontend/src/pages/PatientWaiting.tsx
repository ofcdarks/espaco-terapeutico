import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Video, Mic, MicOff, VideoOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || '';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

export default function PatientWaiting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<number | null>(null);
  const iceIdxRef = useRef(0);

  const [step, setStep] = useState<'joining' | 'waiting' | 'connected' | 'ended' | 'error'>('joining');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  useEffect(() => {
    let active = true;

    const connect = async () => {
      // Wait for host offer
      const waitForOffer = async (): Promise<any> => {
        for (let i = 0; i < 120; i++) { // 2 min timeout
          if (!active) return null;
          try {
            const res = await fetch(`${API}/api/signal/${sessionId}/offer`);
            const data = await res.json();
            if (data.offer) return data.offer;
          } catch {}
          await new Promise(r => setTimeout(r, 1000));
        }
        return null;
      };

      setStep('waiting');
      const offer = await waitForOffer();
      if (!offer || !active) { if (active) setStep('error'); return; }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current && e.streams[0]) {
            remoteVideoRef.current.srcObject = e.streams[0];
            setStep('connected');
          }
        };
        pc.onicecandidate = async (e) => {
          if (e.candidate) {
            await fetch(`${API}/api/signal/${sessionId}/ice/guest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate: e.candidate.toJSON() }) }).catch(() => {});
          }
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') setStep('ended');
        };

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await fetch(`${API}/api/signal/${sessionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: pc.localDescription?.toJSON() }) });

        // Poll for host ICE candidates
        pollRef.current = window.setInterval(async () => {
          try {
            const res = await fetch(`${API}/api/signal/${sessionId}/ice/guest?from=${iceIdxRef.current}`);
            const data = await res.json();
            for (const c of data.candidates) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
            }
            iceIdxRef.current = data.total;
          } catch {}
        }, 1000);

      } catch {
        if (active) setStep('error');
      }
    };

    connect();
    return () => { active = false; if (pollRef.current) clearInterval(pollRef.current); pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [sessionId]);

  const toggleMute = () => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; }); setMuted(!muted); };
  const toggleCam = () => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; }); setCamOff(!camOff); };
  const hangUp = () => { pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); if (pollRef.current) clearInterval(pollRef.current); setStep('ended'); };

  // Waiting screen
  if (step === 'joining' || step === 'waiting') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1a1412' }}>
      <div className="text-center">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(196,168,130,0.1)' }}>
          <Video size={32} style={{ color: '#c4a882' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#e8d8c3' }}>
          {step === 'joining' ? 'Conectando...' : 'Aguardando profissional...'}
        </h1>
        <p className="text-sm mb-8" style={{ color: '#8b7f77' }}>
          {step === 'joining' ? 'Preparando sua conexão' : 'O profissional iniciará a chamada em instantes'}
        </p>
        <Loader2 size={24} className="animate-spin mx-auto mb-8" style={{ color: '#c4a882' }} />
        <div className="p-4 rounded-xl max-w-xs mx-auto text-left" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-xs mb-2" style={{ color: '#b8b0aa' }}>Dicas para uma boa sessão:</p>
          <ul className="text-xs space-y-1.5" style={{ color: '#6b5f57' }}>
            <li>• Escolha um local tranquilo e privado</li>
            <li>• Use fones de ouvido se possível</li>
            <li>• Boa iluminação ajuda na comunicação</li>
            <li>• Permita acesso à câmera e microfone</li>
          </ul>
        </div>
      </div>
    </div>
  );

  // Connected — video call
  if (step === 'connected') return (
    <div className="h-screen flex flex-col" style={{ background: '#0f0a08' }}>
      <div className="flex-1 relative">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-20 right-3 w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(255,255,255,0.1)' }}>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          {camOff && <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#2a2523' }}><VideoOff size={16} style={{ color: '#6b5f57' }} /></div>}
        </div>
      </div>
      <div className="h-20 flex items-center justify-center gap-4" style={{ background: 'rgba(26,20,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={toggleMute} className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: muted ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: muted ? '#ef9a9a' : '#e8d8c3' }}>
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={toggleCam} className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: camOff ? 'rgba(198,40,40,0.2)' : 'rgba(255,255,255,0.08)', color: camOff ? '#ef9a9a' : '#e8d8c3' }}>
          {camOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button onClick={hangUp} className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#c62828', color: 'white' }}>
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );

  // Ended
  if (step === 'ended') return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(84,66,59,0.08)' }}>
          <Video size={24} style={{ color: '#54423b' }} />
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Sessão encerrada</h1>
        <p className="text-sm" style={{ color: '#b8b0aa' }}>Obrigado pela sua sessão. Você pode fechar esta página.</p>
      </div>
    </div>
  );

  // Error
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f5f2ee' }}>
      <div className="text-center">
        <AlertCircle size={40} style={{ color: '#c62828' }} className="mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2" style={{ color: '#2a2523' }}>Não foi possível conectar</h1>
        <p className="text-sm mb-4" style={{ color: '#b8b0aa' }}>Verifique o link com seu profissional e tente novamente.</p>
        <button onClick={() => window.location.reload()} className="h-10 px-6 rounded-xl text-sm font-medium" style={{ background: '#54423b', color: '#f5f2ee' }}>Tentar novamente</button>
      </div>
    </div>
  );
}
